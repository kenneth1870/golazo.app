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

  # API-Football v3 league IDs we care about (men's senior only)
  FEATURED_LEAGUES = Set.new([
    1,    # FIFA World Cup
    2,    # UEFA Champions League
    3,    # UEFA Europa League
    848,  # UEFA Conference League
    531,  # UEFA Super Cup
    39,   # Premier League
    140,  # La Liga
    78,   # Bundesliga
    135,  # Serie A
    61,   # Ligue 1
    88,   # Eredivisie
    94,   # Primeira Liga
    262,  # Liga MX
    71,   # Brasileirão Serie A
    128,  # Argentine Liga Profesional
    253,  # MLS
    179,  # Scottish Premiership
    203,  # Süper Lig
    41,   # Championship (England)
    13,   # Copa Libertadores
    11,   # Copa Sudamericana
    6,    # Copa América
    15,   # FIFA Club World Cup
    10,   # International Friendlies (Men)
    667,  # Friendlies Clubs
    777,  # FIFA World Cup - Qualification CONCACAF
    780,  # FIFA World Cup - Qualification CONMEBOL
    29,   # AFC Asian Cup
    4    # Euro Championship
  ]).freeze

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
    "Oceania",
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
    # race_condition_ttl lets racing requests on cache expiry reuse the stale
    # value for up to 10 s while one writer refreshes — prevents stampede.
    Rails.cache.fetch("live_scores_live_v6", expires_in: 1.minute, race_condition_ttl: 10.seconds) do
      data = get("fixtures", live: "all")
      (data.dig("response") || [])
        .filter_map { |f| normalize_fixture(f) }
        .select     { |m| featured_league?(m) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] live_matches: #{e.message}")
    []
  end

  # All important matches for a given date.
  # Returns every senior men's international/continental competition — World Cup,
  # Copa América, AFCON, Asian/regional friendlies, WC qualifiers, etc. —
  # plus any FEATURED_LEAGUES club competition. Women's and youth excluded.
  def matches_for_date(date, timezone: "UTC")
    date   = date.to_date
    tz_key = timezone.gsub(/[^A-Za-z0-9_]/, "_").downcase
    ttl = date < Date.today ? 24.hours : 10.minutes
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

  # Full match detail: fixture + events + lineups + stats + h2h in parallel.
  #
  # TTL strategy:
  #   Live / pre-match  → 60 s  (doubled from 30 s — halves quota at negligible UX cost)
  #   Finished (FT/AET/PEN) → 24 h  (data never changes after full-time)
  # race_condition_ttl prevents multiple concurrent cache misses each spawning 5
  # upstream threads (thundering herd) — stale value is served for up to 10 s
  # while one writer refreshes.
  def match_detail(fixture_id)
    cache_key = "live_scores_detail_v5_#{fixture_id}"

    result = Rails.cache.fetch(cache_key, expires_in: 60.seconds, race_condition_ttl: 10.seconds) do
      results = {}
      threads = {
        fixture: Thread.new { get("fixtures",            id:      fixture_id) },
        events:  Thread.new { get("fixtures/events",     fixture: fixture_id) },
        lineups: Thread.new { get("fixtures/lineups",    fixture: fixture_id) },
        stats:   Thread.new { get("fixtures/statistics", fixture: fixture_id) }
      }
      threads.each do |k, t|
        results[k] = t.join(10)&.value || {}
      rescue => e
        Rails.logger.warn("[LiveScoresClient] thread #{k}: #{e.message}")
        results[k] = {}
      end

      fx = results[:fixture].dig("response", 0)
      next nil unless fx

      home_id = fx.dig("teams", "home", "id")
      away_id = fx.dig("teams", "away", "id")

      h2h_raw = if home_id && away_id
        get("fixtures/headtohead", h2h: "#{home_id}-#{away_id}", last: 10).dig("response") || []
      else
        []
      end

      {
        fixture:  build_fixture(fx),
        events:   normalize_events(results[:events].dig("response")  || []),
        stats:    normalize_stats(results[:stats].dig("response")    || []),
        lineups:  normalize_lineups(results[:lineups].dig("response") || []),
        h2h:      normalize_h2h(h2h_raw)
      }
    end

    # Promote finished matches to a 24-hour TTL so we never hit the API again.
    if result
      status = result.dig(:fixture, "fixture", "status", "short")
      Rails.cache.write(cache_key, result, expires_in: 24.hours) if %w[FT AET PEN].include?(status)
    end

    result
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
    Rails.cache.fetch("live_scores_standings_v2_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("standings", league: league_id, season: season_id)
      groups = data.dig("response", 0, "league", "standings") || []
      groups.flatten
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] standings: #{e.message}")
    []
  end

  # Top scorers for a league/season. Returns raw API-Football response array.
  def top_scorers(league_id, season_id)
    Rails.cache.fetch("live_scores_scorers_v2_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("players/topscorers", league: league_id, season: season_id)
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_scorers: #{e.message}")
    []
  end

  # All leagues (cached 24 h).
  def leagues
    Rails.cache.fetch("live_scores_leagues_v2", expires_in: 24.hours) do
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
    Rails.cache.fetch("live_scores_player_search_v1_#{season}_#{query.to_s.downcase.strip}", expires_in: 5.minutes) do
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
    Rails.cache.fetch("fixture_preds_v1_#{fixture_id}", expires_in: 24.hours) do
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
    Rails.cache.fetch("fixture_odds_v1_#{fixture_id}", expires_in: 30.minutes) do
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
    Rails.cache.fetch("fixture_injuries_v1_#{fixture_id}", expires_in: 30.minutes) do
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
    Rails.cache.fetch("live_scores_assists_v1_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("players/topassists", league: league_id, season: season_id)
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_assists: #{e.message}")
    []
  end

  def top_yellow_cards(league_id, season_id)
    Rails.cache.fetch("live_scores_yellowcards_v1_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("players/topyellowcards", league: league_id, season: season_id)
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_yellow_cards: #{e.message}")
    []
  end

  def top_red_cards(league_id, season_id)
    Rails.cache.fetch("live_scores_redcards_v1_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("players/topredcards", league: league_id, season: season_id)
      data.dig("response") || []
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] top_red_cards: #{e.message}")
    []
  end

  # ── Venue detail (photo, capacity, surface) ────────────────────────────────

  def venue_detail(venue_id)
    return nil unless venue_id.present?
    Rails.cache.fetch("venue_detail_v1_#{venue_id}", expires_in: 24.hours) do
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
    Rails.cache.fetch("player_trophies_v1_#{player_id}", expires_in: 12.hours) do
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
    Rails.cache.fetch("player_sidelined_v1_#{player_id}", expires_in: 6.hours) do
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

  def featured_league?(match)
    lid       = match[:league_id].to_i
    country   = match[:league_country].to_s
    league    = match[:league_name].to_s
    home_team = match.dig(:home, :name).to_s
    away_team = match.dig(:away, :name).to_s

    # Exclude youth/women by name first so U21/U18 international friendlies are
    # caught even when the league name is just "International Friendlies".
    check = "#{league} #{home_team} #{away_team}"
    return false if check.match?(EXCLUDED_LEAGUE_PATTERN)

    # Allow every senior international/continental competition: World Cup,
    # Copa América, AFCON, AFC, regional friendlies (Philippines vs Myanmar → "Asia"),
    # WC qualifiers, Nations Leagues, etc. Covers far more than country == "World" alone.
    return true if INTERNATIONAL_REGIONS.any? { |r| country.casecmp?(r) }

    # Allow featured club leagues by explicit ID (UCL, Premier League, etc.)
    FEATURED_LEAGUES.include?(lid)
  end

  # Normalize a raw API-Football fixture object to our internal shape.
  # This is the same shape that today_controller's normalize_api expects.
  def normalize_fixture(f)
    short  = f.dig("fixture", "status", "short")
    status = STATUS_MAP[short]
    return nil unless status

    {
      external_id:    f.dig("fixture", "id"),
      league_id:      f.dig("league", "id"),
      league_name:    f.dig("league", "name"),
      league_logo:    f.dig("league", "logo"),
      league_country: f.dig("league", "country"),
      kickoff_at:     f.dig("fixture", "date"),
      status:         status,
      status_short:   short,
      minute:         f.dig("fixture", "status", "elapsed"),
      venue:          f.dig("fixture", "venue", "name"),
      home: {
        name:      f.dig("teams", "home", "name"),
        logo:      f.dig("teams", "home", "logo"),
        score:     f.dig("goals", "home"),
        red_cards: nil
      },
      away: {
        name:      f.dig("teams", "away", "name"),
        logo:      f.dig("teams", "away", "logo"),
        score:     f.dig("goals", "away"),
        red_cards: nil
      }
    }
  end

  # Build the fixture hash in the shape MatchShowPage.jsx expects.
  def build_fixture(fx)
    {
      "fixture" => {
        "id"     => fx.dig("fixture", "id"),
        "date"   => fx.dig("fixture", "date"),
        "status" => {
          "short"   => fx.dig("fixture", "status", "short"),
          "long"    => fx.dig("fixture", "status", "long"),
          "elapsed" => fx.dig("fixture", "status", "elapsed")
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
        "home" => {
          "id"     => fx.dig("teams", "home", "id"),
          "name"   => fx.dig("teams", "home", "name"),
          "logo"   => fx.dig("teams", "home", "logo"),
          "winner" => fx.dig("teams", "home", "winner")
        },
        "away" => {
          "id"     => fx.dig("teams", "away", "id"),
          "name"   => fx.dig("teams", "away", "name"),
          "logo"   => fx.dig("teams", "away", "logo"),
          "winner" => fx.dig("teams", "away", "winner")
        }
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
        minute:   e.dig("time", "elapsed"),
        extra:    e.dig("time", "extra"),
        team:     { name: e.dig("team", "name"),     logo: e.dig("team", "logo") },
        player:   e.dig("player", "name"),
        assist:   e.dig("assist", "name"),
        type:     e["type"].to_s,
        detail:   e["detail"] || e["type"].to_s,
        comments: e["comments"]
      }
    end
  end

  def normalize_stats(raw)
    raw.map do |td|
      {
        team:  { name: td.dig("team", "name"), logo: td.dig("team", "logo") },
        stats: (td["statistics"] || []).map { |s| { type: s["type"], value: s["value"] } }
      }
    end
  end

  def normalize_lineups(raw)
    raw.map do |t|
      {
        team:      { name: t.dig("team", "name"), logo: t.dig("team", "logo"), colors: t.dig("team", "colors") },
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

  def get(path, params = {})
    resp = @conn.get(path, params)
    JSON.parse(resp.body)
  rescue => e
    Rails.logger.error("[LiveScoresClient] GET #{path} #{params}: #{e.message}")
    {}
  end
end
