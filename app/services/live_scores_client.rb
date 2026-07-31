require "set"

# Primary live-scores client backed by API-Football v3 (api-sports.io).
# Auth: x-apisports-key header. Base: https://v3.football.api-sports.io/
#
# Public interface:
#   live_matches        → Array of normalized match hashes
#   matches_for_date(d) → Array of normalized match hashes
#   match_detail(id)    → { fixture:, events:, stats:, lineups:, h2h: } or nil
#   match_from_list(id) → basic fixture hash or nil (fallback)
#   league_standings(league_id, season) → Array of standing rows
#   top_scorers(league_id, season)      → Array of scorer hashes
#   leagues                             → Array of league hashes
#   search_players(query)               → Array of player hashes

class LiveScoresClient
  BASE_URL = "https://v3.football.api-sports.io/".freeze

  # API-Football v3 status short-code → our internal status
  STATUS_MAP = {
    "NS"   => "scheduled",
    "TBD"  => "scheduled",
    "1H"   => "live",
    "HT"   => "live",
    "2H"   => "live",
    "ET"   => "live",
    "BT"   => "live",
    "P"    => "live",
    "SUSP" => "live",
    "INT"  => "live",
    "LIVE" => "live",
    "FT"   => "finished",
    "AET"  => "finished",
    "PEN"  => "finished",
    "AWD"  => "finished",
    "WO"   => "finished",
    "PST"  => "postponed",
    "CANC" => "postponed",
    "ABD"  => "postponed"
  }.freeze

  # Trimmed list — friendlies and minor cups removed; AppFocus.allowed_league_ids
  # is the source of truth for what we show in clubs mode.
  FEATURED_LEAGUES = Set.new([
    1,    # FIFA World Cup
    2,    # UEFA Champions League
    39,   # Premier League
    140,  # La Liga
    78,   # Bundesliga
    135,  # Serie A
    61,   # Ligue 1
    253,  # MLS
    162,  # Liga Tica (Costa Rica Primera División)
    262,  # Liga MX
    1028, # CONCACAF Central American Cup (Copa Centroamericana)
    16    # CONCACAF Champions League (Concachampions)
  ]).freeze

  # Always excluded — low-value fixtures that waste API quota in caches/UI.
  FRIENDLY_LEAGUE_IDS = Set.new([ 10, 667 ]).freeze

  # Regex that matches youth (U17/U20/U21/U23) and women's competitions by name.
  EXCLUDED_LEAGUE_PATTERN = /
    \b(u\s?1[5-9]|u\s?2[0-3])\b   # U15–U23 age brackets
    | \bwomen\b | \bwomens\b
    | \bfemale\b | \bgirls\b
    | \bwsl\b | \bnwsl\b           # Women's Super League, NWSL
    | \bw\s+league\b               # generic "W League"
  /xi.freeze

  # league_country values that represent international/continental competitions.
  # featured_league? returns true for any match whose country is in this list,
  # keeping national-team matches from every confederation (Philippines vs Myanmar
  # → "Asia", AFCON qualifiers → "Africa", etc.) while domestic club leagues
  # (Premier League → "England", La Liga → "Spain") fall through to FEATURED_LEAGUES.
  INTERNATIONAL_REGIONS = [
    "World",
    "Asia",
    "Africa",
    "Europe",
    "South America",
    "North America",
    "Oceania"
  ].freeze

  def initialize
    key = ENV["APISPORTS_KEY"].presence
    raise "APISPORTS_KEY not configured" if key.blank?

    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-apisports-key"] = key
      f.options.timeout      = 10
      f.options.open_timeout = 6
      f.request :retry, max: 2, interval: 0.5
    end
  end

  # ── Public interface ──────────────────────────────────────────────────────

  # Currently live matches across all leagues (senior men's only)
  def live_matches
    # 20 s TTL so the ~30 s live-sync loop (SyncLiveScoresJob +30s follow-up)
    # reads fresh scores — goal/full-time alerts fire within ~30 s of the event
    # instead of up to a minute — while still deduping any incidental concurrent
    # calls. race_condition_ttl lets racing requests reuse the stale value for up
    # to 10 s while one writer refreshes (anti-stampede).
    Rails.cache.fetch("live_scores_live_v6", expires_in: 20.seconds, race_condition_ttl: 10.seconds) do
      data = get("fixtures", live: "all")
      (data.dig("response") || [])
        .filter_map { |f| normalize_fixture(f) }
        .select     { |m| featured_league?(m) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] live_matches: #{e.message}")
    []
  end

  # Fresh fixture status for list reconciliation (short TTL).
  def fixture_status(fixture_id)
    Rails.cache.fetch("live_scores_status_v1_#{fixture_id}", expires_in: 30.seconds, race_condition_ttl: 5.seconds) do
      fx = get("fixtures", id: fixture_id).dig("response", 0)
      normalize_fixture(fx) if fx
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] fixture_status(#{fixture_id}): #{e.message}")
    nil
  end

  # All important matches for a given date.
  # Returns every senior men's international/continental competition — World Cup,
  # Copa América, AFCON, Asian/regional friendlies, WC qualifiers, etc. —
  # plus any FEATURED_LEAGUES club competition. Women's and youth excluded.
  def matches_for_date(date, timezone: "UTC")
    date   = date.to_date
    tz_key = timezone.gsub(/[^A-Za-z0-9_]/, "_").downcase
    # Past dates: data never changes, cache for 24h.
    # Today: live scores arrive via ActionCable/live-sync, not this endpoint —
    #   5 min TTL is plenty; manual cache busting on score/status changes still
    #   ensures SyncTodayMatchesJob gets fresh data when something happens.
    # Future: schedule rarely changes, 10 min is fine.
    ttl = if date < Date.today then 24.hours
    elsif date == Date.today then 5.minutes
    else 10.minutes
    end
    Rails.cache.fetch("live_scores_date_v15_#{date.iso8601}_#{tz_key}", expires_in: ttl, race_condition_ttl: 30.seconds) do
      data = get("fixtures", date: date.iso8601, timezone: timezone)
      (data.dig("response") || [])
        .filter_map { |f| normalize_fixture(f) }
        .select     { |m| featured_league?(m) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] matches_for_date(#{date}): #{e.message}")
    []
  end

  # Fixtures for one league over a date range — avoids the shared per-day cache
  # missing newly-added leagues and cuts API noise vs fetching every match on each day.
  def current_season_for_league(league_id, code)
    Rails.cache.fetch("league_current_season_v1_#{league_id}", expires_in: 12.hours, race_condition_ttl: 30.seconds) do
      data    = get("leagues", id: league_id)
      current = data.dig("response", 0, "seasons")&.find { |s| s["current"] }
      current&.dig("year") || AppFocus.season_for(code)
    end
  rescue => e
    Rails.logger.warn("[LiveScoresClient] current_season_for_league(#{league_id}): #{e.message}")
    AppFocus.season_for(code)
  end

  def matches_for_league(league_id, from:, to:, code:, timezone: "UTC", season: nil)
    from   = from.to_date
    to     = to.to_date
    season = season || current_season_for_league(league_id, code)
    tz_key = timezone.gsub(/[^A-Za-z0-9_\/+-]/, "_").downcase
    ttl    = to < Date.today ? 24.hours : 5.minutes

    Rails.cache.fetch(
      "live_scores_league_v1_#{league_id}_#{season}_#{from.iso8601}_#{to.iso8601}_#{tz_key}",
      expires_in: ttl, race_condition_ttl: 30.seconds
    ) do
      data = get("fixtures", league: league_id, season: season,
                         from: from.iso8601, to: to.iso8601, timezone: timezone)
      (data.dig("response") || []).filter_map { |f| normalize_fixture(f) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] matches_for_league(#{league_id}): #{e.message}")
    []
  end

  DETAIL_SECTIONS = %w[fixture events stats lineups h2h].freeze

  # Match detail with optional section filter. Each section is cached independently
  # so the frontend can load fixture+events first and fetch stats/lineups/h2h on tab open.
  # Pass include: nil for a full fetch (jobs, admin heal).
  def match_detail(fixture_id, include: nil)
    sections = normalize_detail_sections(include)
    result   = {}

    if sections.include?("fixture")
      result[:fixture] = fetch_detail_fixture(fixture_id)
      return nil unless result[:fixture]
    end

    parallel = sections & %w[events stats lineups]
    if parallel.any?
      threads = parallel.index_with { |section| Thread.new { fetch_detail_section(fixture_id, section) } }
      threads.each do |section, thread|
        result[section.to_sym] = thread.join(10)&.value
      rescue => e
        Rails.logger.warn("[LiveScoresClient] detail #{section}: #{e.message}")
        result[section.to_sym] = []
      ensure
        thread.kill if thread.alive?
      end
    end

    if sections.include?("h2h")
      fx = result[:fixture] || fetch_detail_fixture(fixture_id)
      if fx
        home_id = fx.dig("teams", "home", "id")
        away_id = fx.dig("teams", "away", "id")
        result[:h2h] = fetch_detail_h2h(home_id, away_id) if home_id && away_id
      end
      result[:h2h] ||= normalize_h2h([])
    end

    apply_detail_fixture_ttl!(fixture_id, result[:fixture]) if result[:fixture]
    result.presence
  rescue => e
    Rails.logger.error("[LiveScoresClient] match_detail(#{fixture_id}): #{e.message}")
    nil
  end

  # Tries today ±1 day date-list caches; builds a minimal fixture from list data.
  # Used as last-resort fallback when full detail API returns nothing.
  def match_from_list(match_id)
    [ Date.today - 1, Date.today, Date.today + 1 ].each do |d|
      found = matches_for_date(d).find { |m| m[:external_id].to_s == match_id.to_s }
      return build_detail_from_list(found) if found
    end
    nil
  rescue => e
    Rails.logger.warn("[LiveScoresClient] match_from_list #{match_id}: #{e.message}")
    nil
  end

  # Standings for a league/season. Returns flat array of standing rows
  # (groups already flattened so callers can re-group by group_name if needed).
  def league_standings(league_id, season_id)
    # Standings change only when a match finishes; 30 min matches the sync job cadence.
    Rails.cache.fetch("live_scores_standings_v3_#{league_id}_#{season_id}", expires_in: 30.minutes, race_condition_ttl: 15.seconds) do
      data = get("standings", league: league_id, season: season_id)
      groups = data.dig("response", 0, "league", "standings") || []
      groups.flatten
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] standings: #{e.message}")
    []
  end

  # Current season first; falls back to previous when empty (off-season / UCL group stage).
  def league_standings_for_code(code)
    league_id = AppFocus.league_id_for(code)
    return [] unless league_id

    season = current_season_for_league(league_id, code)
    rows   = league_standings(league_id, season)
    return rows if rows.present?

    prev = season.to_i - 1
    return [] if prev < 2000

    league_standings(league_id, prev)
  end

  # Top scorers for a league/season. Returns raw API-Football response array.
  def top_scorers(league_id, season_id)
    cached = Rails.cache.fetch("live_scores_scorers_v2_#{league_id}_#{season_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      data = get("players/topscorers", league: league_id, season: season_id)
      data.dig("response") || []
    end
    cached.presence || []
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_scorers: #{e.message}")
    []
  end

  # All leagues (cached 24 h).
  def leagues
    Rails.cache.fetch("live_scores_leagues_v2", expires_in: 24.hours, race_condition_ttl: 30.seconds) do
      data = get("leagues", current: "true")
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] leagues: #{e.message}")
    []
  end

  # Player search by name.
  def search_players(query)
    season = Date.today.year
    # Cache per normalized query — identical searches within 5 min share one upstream call.
    Rails.cache.fetch("live_scores_player_search_v1_#{season}_#{query.to_s.downcase.strip}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      data = get("players", search: query, season: season)
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.warn("[LiveScoresClient] search_players: #{e.message}")
    []
  end

  # ── Predictions ───────────────────────────────────────────────────────────────

  def fixture_predictions(fixture_id)
    # Pre-match AI predictions are published once and never change — cache for 24 h.
    Rails.cache.fetch("fixture_preds_v1_#{fixture_id}", expires_in: 24.hours, race_condition_ttl: 30.seconds) do
      raw = get("predictions", fixture: fixture_id)
      r   = raw.dig("response", 0)
      next nil unless r

      predictions = r["predictions"] || {}
      comparison  = r["comparison"]  || {}
      teams       = r["teams"]       || {}

      {
        winner: {
          id:      predictions.dig("winner", "id"),
          name:    predictions.dig("winner", "name")
        },
        percent: {
          home: predictions.dig("percent", "home"),
          draw: predictions.dig("percent", "draw"),
          away: predictions.dig("percent", "away")
        },
        goals: {
          home: predictions.dig("goals", "home"),
          away: predictions.dig("goals", "away")
        },
        advice:     predictions["advice"],
        under_over: predictions["under_over"],
        comparison: {
          form:  comparison["form"],
          att:   comparison["att"],
          def:   comparison["def"],
          h2h:   comparison["h2h"],
          goals: comparison["goals"],
          total: comparison["total"]
        },
        home_form: teams.dig("home", "last_5", "form"),
        away_form: teams.dig("away", "last_5", "form")
      }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] fixture_predictions(#{fixture_id}): #{e.message}")
    nil
  end

  # ── Odds ────────────────────────────────────────────────────────────────────

  def fixture_odds(fixture_id)
    Rails.cache.fetch("fixture_odds_v1_#{fixture_id}", expires_in: 30.minutes, race_condition_ttl: 15.seconds) do
      raw        = get("odds", fixture: fixture_id)
      r          = raw.dig("response", 0)
      next({}) unless r

      bookmakers = Array(r["bookmakers"])
      next({}) if bookmakers.empty?

      bk = bookmakers.find { |b| [ "Bet365", "Bwin", "10Bet" ].include?(b["name"]) } || bookmakers.first
      next({}) unless bk

      result = { bookmaker: bk["name"], bets: {} }
      Array(bk["bets"]).each do |bet|
        result[:bets][bet["name"]] = Array(bet["values"]).map { |v| { value: v["value"], odd: v["odd"] } }
      end
      result
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] fixture_odds(#{fixture_id}): #{e.message}")
    {}
  end

  def fixture_odds_live(fixture_id)
    Rails.cache.fetch("fixture_odds_live_v1_#{fixture_id}", expires_in: 30.seconds, race_condition_ttl: 10.seconds) do
      raw = get("odds/live", fixture: fixture_id)
      r   = raw.dig("response", 0)
      next nil unless r

      {
        elapsed: r.dig("fixture", "status", "elapsed"),
        goals:   { home: r.dig("teams", "home", "goals"), away: r.dig("teams", "away", "goals") },
        updated: r["update"],
        bets:    Array(r["odds"]).map { |o|
          { name: o["name"], values: Array(o["values"]).map { |v| { value: v["value"], odd: v["odd"] } } }
        }
      }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] fixture_odds_live(#{fixture_id}): #{e.message}")
    nil
  end

  # ── Player extras ────────────────────────────────────────────────────────────

  # ── Player ratings per fixture ────────────────────────────────────────────

  def player_ratings(fixture_id)
    Rails.cache.fetch("fixture_ratings_v1_#{fixture_id}", expires_in: 60.seconds, race_condition_ttl: 10.seconds) do
      raw = get("fixtures/players", fixture: fixture_id)
      (raw.dig("response") || []).map do |team|
        {
          team: { name: team.dig("team", "name"), logo: team.dig("team", "logo") },
          players: (team["players"] || []).map do |p|
            pl = p["player"] || {}
            st = (p["statistics"] || []).first || {}
            {
              id:       pl["id"],
              name:     pl["name"],
              photo:    pl["photo"],
              number:   st.dig("games", "number"),
              position: st.dig("games", "position"),
              rating:   st.dig("games", "rating"),
              minutes:  st.dig("games", "minutes"),
              captain:  st.dig("games", "captain"),
              shots:     { total: st.dig("shots", "total"),    on:      st.dig("shots", "on") },
              goals:     { total: st.dig("goals", "total"),    assists: st.dig("goals", "assists") },
              passes:    { total: st.dig("passes", "total"),   accuracy: st.dig("passes", "accuracy") },
              tackles:   { total: st.dig("tackles", "total"),  interceptions: st.dig("tackles", "interceptions") },
              dribbles:  { attempts: st.dig("dribbles", "attempts"), success: st.dig("dribbles", "success") },
              fouls:     { committed: st.dig("fouls", "committed"),  drawn: st.dig("fouls", "drawn") },
              cards:     { yellow: st.dig("cards", "yellow"), red: st.dig("cards", "red") }
            }
          end
        }
      end
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] player_ratings(#{fixture_id}): #{e.message}")
    []
  end

  # ── Pre-match injuries / suspensions ─────────────────────────────────────

  def fixture_injuries(fixture_id)
    Rails.cache.fetch("fixture_injuries_v1_#{fixture_id}", expires_in: 30.minutes, race_condition_ttl: 15.seconds) do
      raw = get("injuries", fixture: fixture_id)
      (raw.dig("response") || []).map do |r|
        {
          player: { id: r.dig("player", "id"), name: r.dig("player", "name"), photo: r.dig("player", "photo") },
          team:   { id: r.dig("team", "id"),   name: r.dig("team", "name"),   logo:  r.dig("team", "logo") },
          type:   r["type"],
          reason: r["reason"]
        }
      end
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] fixture_injuries(#{fixture_id}): #{e.message}")
    []
  end

  # ── Tournament leaderboards ───────────────────────────────────────────────

  def top_assists(league_id, season_id)
    cached = Rails.cache.fetch("live_scores_assists_v1_#{league_id}_#{season_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      data = get("players/topassists", league: league_id, season: season_id)
      data.dig("response") || []
    end
    cached.presence || []
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_assists: #{e.message}")
    []
  end

  def top_yellow_cards(league_id, season_id)
    cached = Rails.cache.fetch("live_scores_yellowcards_v1_#{league_id}_#{season_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      data = get("players/topyellowcards", league: league_id, season: season_id)
      data.dig("response") || []
    end
    cached.presence || []
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_yellow_cards: #{e.message}")
    []
  end

  def top_red_cards(league_id, season_id)
    cached = Rails.cache.fetch("live_scores_redcards_v1_#{league_id}_#{season_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      data = get("players/topredcards", league: league_id, season: season_id)
      data.dig("response") || []
    end
    cached.presence || []
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_red_cards: #{e.message}")
    []
  end

  # ── Venue detail (photo, capacity, surface) ────────────────────────────────

  # Lightweight single-fixture fetch just to resolve the venue ID.
  # Cached 7 days — venue IDs don't change.
  def fixture_venue_id(fixture_id)
    Rails.cache.fetch("fixture_venue_id_v1_#{fixture_id}", expires_in: 7.days, race_condition_ttl: 60.seconds) do
      raw = get("fixtures", id: fixture_id)
      raw.dig("response", 0, "fixture", "venue", "id")
    end
  rescue => e
    Rails.logger.warn("[LiveScoresClient] fixture_venue_id(#{fixture_id}): #{e.message}")
    nil
  end

  def venue_detail(venue_id)
    return nil unless venue_id.present?
    Rails.cache.fetch("venue_detail_v1_#{venue_id}", expires_in: 24.hours, race_condition_ttl: 30.seconds) do
      raw = get("venues", id: venue_id)
      v   = raw.dig("response", 0)
      next nil unless v
      {
        id:       v["id"],
        name:     v["name"],
        city:     v["city"],
        country:  v["country"],
        capacity: v["capacity"],
        surface:  v["surface"],
        image:    v["image"]
      }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] venue_detail(#{venue_id}): #{e.message}")
    nil
  end

  # ── Player extras ────────────────────────────────────────────────────────────

  def player_transfers(player_id)
    cached = Rails.cache.read("player_transfers_v1_#{player_id}")
    return cached if cached&.any?

    raw = get("transfers", player: player_id)
    r   = raw.dig("response", 0)
    return [] unless r

    result = Array(r["transfers"]).map do |t|
      {
        date: t["date"],
        type: t["type"],
        from: { id: t.dig("teams", "out", "id"), name: t.dig("teams", "out", "name"), logo: t.dig("teams", "out", "logo") },
        to:   { id: t.dig("teams", "in",  "id"), name: t.dig("teams", "in",  "name"), logo: t.dig("teams", "in",  "logo") }
      }
    end.reverse

    # Only cache non-empty results — empty could mean rate-limit, not truly no transfers
    Rails.cache.write("player_transfers_v1_#{player_id}", result, expires_in: 12.hours) if result.any?
    result
  rescue => e
    Rails.logger.error("[LiveScoresClient] player_transfers(#{player_id}): #{e.message}")
    []
  end

  def player_trophies(player_id)
    Rails.cache.fetch("player_trophies_v1_#{player_id}", expires_in: 12.hours, race_condition_ttl: 30.seconds) do
      raw = get("trophies", player: player_id)
      Array(raw.dig("response")).map do |t|
        { league: t["league"], place: t["place"], season: t["season"], country: t["country"] }
      end.sort_by { |t| -(t[:season]&.slice(0, 4)&.to_i || 0) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] player_trophies(#{player_id}): #{e.message}")
    []
  end

  def player_sidelined(player_id)
    Rails.cache.fetch("player_sidelined_v1_#{player_id}", expires_in: 6.hours, race_condition_ttl: 30.seconds) do
      raw = get("sidelined", player: player_id)
      Array(raw.dig("response")).map do |s|
        { type: s["type"], start: s["start"], end_date: s["end"] }
      end
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] player_sidelined(#{player_id}): #{e.message}")
    []
  end

  # ── Private ───────────────────────────────────────────────────────────────

  private

  def fixture_goal_scores(f)
    home = f.dig("goals", "home")
    away = f.dig("goals", "away")
    if home.nil? && away.nil?
      home = f.dig("score", "fulltime", "home")
      away = f.dig("score", "fulltime", "away")
    end
    [ home, away ]
  end

  def normalize_detail_sections(include)
    return DETAIL_SECTIONS if include.nil?

    list = Array(include).map(&:to_s) & DETAIL_SECTIONS
    list.presence || DETAIL_SECTIONS
  end

  def fetch_detail_fixture(fixture_id)
    Rails.cache.fetch("live_scores_detail_fixture_v6_#{fixture_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      fx = get("fixtures", id: fixture_id).dig("response", 0)
      fx ? build_fixture(fx) : nil
    end
  end

  def fetch_detail_section(fixture_id, section)
    endpoint = case section
    when "events"  then [ "fixtures/events",     { fixture: fixture_id } ]
    when "stats"   then [ "fixtures/statistics", { fixture: fixture_id } ]
    when "lineups" then [ "fixtures/lineups",    { fixture: fixture_id } ]
    else return []
    end

    Rails.cache.fetch("live_scores_detail_#{section}_v6_#{fixture_id}", expires_in: 5.minutes, race_condition_ttl: 10.seconds) do
      raw = get(endpoint[0], **endpoint[1]).dig("response") || []
      case section
      when "events"  then normalize_events(raw)
      when "stats"   then normalize_stats(raw)
      when "lineups" then normalize_lineups(raw)
      else []
      end
    end
  end

  def fetch_detail_h2h(home_id, away_id)
    Rails.cache.fetch("live_scores_h2h_v1_#{home_id}_#{away_id}", expires_in: 24.hours, race_condition_ttl: 30.seconds) do
      raw = get("fixtures/headtohead", h2h: "#{home_id}-#{away_id}", last: 10).dig("response") || []
      normalize_h2h(raw)
    end
  end

  def apply_detail_fixture_ttl!(fixture_id, fixture)
    status = fixture.dig("fixture", "status", "short")
    key    = "live_scores_detail_fixture_v6_#{fixture_id}"
    if %w[FT AET PEN].include?(status)
      Rails.cache.write(key, fixture, expires_in: 24.hours)
    elsif %w[1H 2H HT ET BT P].include?(status)
      Rails.cache.write(key, fixture, expires_in: 60.seconds)
    end
  end

  def featured_league?(match)
    lid       = match[:league_id].to_i
    league    = match[:league_name].to_s
    home_team = match.dig(:home, :name).to_s
    away_team = match.dig(:away, :name).to_s

    return false if FRIENDLY_LEAGUE_IDS.include?(lid)
    return false if league.match?(/friendlies?\b/i)

    check = "#{league} #{home_team} #{away_team}"
    return false if check.match?(EXCLUDED_LEAGUE_PATTERN)

    return AppFocus.allowed_league?(lid) if AppFocus.wc_paused?

    return false if AppFocus.excluded_match?(match)

    return true if lid == AppFocus.league_id_for("WC")

    return true if AppFocus.allowed_league?(lid)

    # WC / both mode: senior internationals (qualifiers, continental cups) — not club friendlies.
    country = match[:league_country].to_s
    if INTERNATIONAL_REGIONS.any? { |r| country.casecmp?(r) } && !league.match?(/friendlies?\b/i)
      return true
    end

    FEATURED_LEAGUES.include?(lid)
  end

  # Normalize a raw API-Football fixture object to our internal shape.
  # This is the same shape that today_controller's normalize_api expects.
  def normalize_fixture(f)
    short  = f.dig("fixture", "status", "short")
    status = STATUS_MAP[short]
    return nil unless status

    home_score, away_score = fixture_goal_scores(f)

    {
      external_id:    f.dig("fixture", "id"),
      league_id:      f.dig("league", "id"),
      league_name:    f.dig("league", "name"),
      league_logo:    f.dig("league", "logo"),
      league_country: f.dig("league", "country"),
      round:          f.dig("league", "round"),
      kickoff_at:     f.dig("fixture", "date"),
      status:         status,
      status_short:   short,
      minute:         f.dig("fixture", "status", "elapsed"),
      minute_extra:   f.dig("fixture", "status", "extra"),
      venue:          f.dig("fixture", "venue", "name"),
      home: {
        name:      TeamDisplayNames.display_name(f.dig("teams", "home", "name")),
        logo:      TeamDisplayNames.flag_url(f.dig("teams", "home", "name"), f.dig("teams", "home", "logo")),
        score:     home_score,
        pen_score: f.dig("score", "penalty", "home"),
        red_cards: nil
      },
      away: {
        name:      TeamDisplayNames.display_name(f.dig("teams", "away", "name")),
        logo:      TeamDisplayNames.flag_url(f.dig("teams", "away", "name"), f.dig("teams", "away", "logo")),
        score:     away_score,
        pen_score: f.dig("score", "penalty", "away"),
        red_cards: nil
      },
      last_scorer: begin
        evts = f["events"] || []
        goal = evts.select { |e| e["type"] == "Goal" && e.dig("detail") != "Own Goal" && e.dig("detail") != "Goal Disallowed" }.last
        goal&.dig("player", "name").presence
      end,
      var_disallowed: begin
        evts = f["events"] || []
        evts.any? { |e| e["type"] == "Goal" && e.dig("detail") == "Goal Disallowed" }
      end,
      var_disallowed_scorer: begin
        evts = f["events"] || []
        disallowed = evts.select { |e| e["type"] == "Goal" && e.dig("detail") == "Goal Disallowed" }.last
        disallowed&.dig("player", "name").presence
      end,
      var_disallowed_reason: begin
        evts = f["events"] || []
        disallowed = evts.select { |e| e["type"] == "Goal" && e.dig("detail") == "Goal Disallowed" }.last
        disallowed&.dig("comments").presence
      end
    }
  end

  # Build the fixture hash in the shape MatchShowPage.jsx expects.
  def build_fixture(fx)
    {
      "fixture" => {
        "id"       => fx.dig("fixture", "id"),
        "date"     => fx.dig("fixture", "date"),
        "referee"  => fx.dig("fixture", "referee"),
        "status" => {
          "short"   => fx.dig("fixture", "status", "short"),
          "long"    => fx.dig("fixture", "status", "long"),
          "elapsed" => fx.dig("fixture", "status", "elapsed"),
          "extra"   => fx.dig("fixture", "status", "extra")
        },
        "venue" => {
          "id"   => fx.dig("fixture", "venue", "id"),
          "name" => fx.dig("fixture", "venue", "name"),
          "city" => fx.dig("fixture", "venue", "city")
        }
      },
      "league" => {
        "id"      => fx.dig("league", "id"),
        "name"    => fx.dig("league", "name"),
        "logo"    => fx.dig("league", "logo"),
        "country" => fx.dig("league", "country"),
        "round"   => fx.dig("league", "round")
      },
      "teams" => {
        "home" => team_payload(fx.dig("teams", "home", "name"), fx.dig("teams", "home", "logo")).merge(
          "id"     => fx.dig("teams", "home", "id"),
          "winner" => fx.dig("teams", "home", "winner")
        ),
        "away" => team_payload(fx.dig("teams", "away", "name"), fx.dig("teams", "away", "logo")).merge(
          "id"     => fx.dig("teams", "away", "id"),
          "winner" => fx.dig("teams", "away", "winner")
        )
      },
      "goals" => {
        "home" => fx.dig("goals", "home"),
        "away" => fx.dig("goals", "away")
      }
    }
  end

  def normalize_events(raw)
    raw.map do |e|
      {
        minute:     e.dig("time", "elapsed"),
        extra:      e.dig("time", "extra"),
        team:       team_payload(e.dig("team", "name"), e.dig("team", "logo")),
        player:     e.dig("player", "name"),
        player_id:  e.dig("player", "id"),
        assist:     e.dig("assist", "name"),
        assist_id:  e.dig("assist", "id"),
        type:       e["type"].to_s,
        detail:     e["detail"] || e["type"].to_s,
        comments:   e["comments"]
      }
    end
  end

  def normalize_stats(raw)
    raw.map do |td|
      {
        team:  team_payload(td.dig("team", "name"), td.dig("team", "logo")),
        stats: (td["statistics"] || []).map { |s| { type: s["type"], value: s["value"] } }
      }
    end
  end

  def normalize_lineups(raw)
    raw.map do |t|
      {
        team:      team_payload(t.dig("team", "name"), t.dig("team", "logo")).merge(colors: t.dig("team", "colors")),
        formation: t["formation"],
        start_xi:  (t["startXI"] || []).map { |p|
          pl = p["player"] || {}
          { name: pl["name"], number: pl["number"], pos: pl["pos"], grid: pl["grid"] }
        },
        subs:      (t["substitutes"] || []).map { |p|
          pl = p["player"] || {}
          { name: pl["name"], number: pl["number"], pos: pl["pos"] }
        },
        coach:     t.dig("coach", "name")
      }
    end
  end

  def normalize_h2h(raw)
    matches = raw.map do |fx|
      {
        kickoff_at:  fx.dig("fixture", "date"),
        status:      fx.dig("fixture", "status", "long") || "Finished",
        home: {
          name:  fx.dig("teams", "home", "name"),
          logo:  fx.dig("teams", "home", "logo"),
          score: fx.dig("goals", "home") || fx.dig("score", "fulltime", "home")
        },
        away: {
          name:  fx.dig("teams", "away", "name"),
          logo:  fx.dig("teams", "away", "logo"),
          score: fx.dig("goals", "away") || fx.dig("score", "fulltime", "away")
        },
        competition: { name: fx.dig("league", "name") }
      }
    end
    { summary: nil, matches: matches }
  end

  def build_detail_from_list(m)
    status_long = {
      "NS" => "Not Started", "1H" => "First Half", "HT" => "Half Time",
      "2H" => "Second Half", "ET" => "Extra Time",  "P"  => "Penalties",
      "FT" => "Full Time",  "AET" => "After Extra Time", "PEN" => "After Penalties"
    }
    short = m[:status_short] || (m[:status] == "finished" ? "FT" : m[:status] == "live" ? "1H" : "NS")

    fixture = {
      "fixture" => {
        "id"     => m[:external_id],
        "date"   => m[:kickoff_at],
        "status" => { "short" => short, "long" => status_long[short] || short, "elapsed" => m[:minute] },
        "venue"  => { "name" => m[:venue], "city" => nil }
      },
      "league" => {
        "id"      => m[:league_id],
        "name"    => m[:league_name],
        "logo"    => m[:league_logo],
        "country" => m[:league_country],
        "round"   => nil
      },
      "teams" => {
        "home" => { "id" => nil, "name" => m.dig(:home, :name), "logo" => m.dig(:home, :logo), "winner" => nil },
        "away" => { "id" => nil, "name" => m.dig(:away, :name), "logo" => m.dig(:away, :logo), "winner" => nil }
      },
      "goals" => { "home" => m.dig(:home, :score), "away" => m.dig(:away, :score) }
    }
    { fixture: fixture, events: [], stats: [], lineups: [] }
  end

  def team_payload(name, logo)
    {
      name: TeamDisplayNames.display_name(name),
      logo: TeamDisplayNames.flag_url(name, logo)
    }
  end

  def get(path, params = {})
    resp = @conn.get(path, params)
    unless resp.success?
      Rails.logger.error("[LiveScoresClient] GET #{path} HTTP #{resp.status}")
      raise Faraday::Error, "HTTP #{resp.status}"
    end
    body = JSON.parse(resp.body)
    if body["errors"].present?
      Rails.logger.error("[LiveScoresClient] GET #{path} API errors: #{body['errors']}")
      raise Faraday::Error, body["errors"].to_s
    end
    body
  rescue JSON::ParserError => e
    Rails.logger.error("[LiveScoresClient] GET #{path} invalid JSON: #{e.message}")
    raise
  rescue Faraday::Error
    raise
  rescue => e
    Rails.logger.error("[LiveScoresClient] GET #{path} #{params}: #{e.message}")
    raise Faraday::Error, e.message
  end
end
