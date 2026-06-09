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
    "ABD"  => "postponed",
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
    4,    # Euro Championship
  ]).freeze

  # Regex that matches youth (U17/U20/U21/U23) and women's competitions by name.
  EXCLUDED_LEAGUE_PATTERN = /
    \b(u\s?1[5-9]|u\s?2[0-3])\b   # U15–U23 age brackets
    | \bwomen\b | \bwomens\b
    | \bfemale\b | \bgirls\b
    | \bwsl\b | \bnwsl\b           # Women's Super League, NWSL
    | \bw\s+league\b               # generic "W League"
  /xi.freeze

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
    Rails.cache.fetch("live_scores_live_v5", expires_in: 1.minute) do
      data = get("fixtures", live: "all")
      (data.dig("response") || [])
        .filter_map { |f| normalize_fixture(f) }
        .select     { |m| featured_league?(m) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] live_matches: #{e.message}")
    []
  end

  # All featured matches for a given date (UTC).
  def matches_for_date(date)
    Rails.cache.fetch("live_scores_date_v12_#{date.to_date.iso8601}", expires_in: 10.minutes) do
      data = get("fixtures", date: date.to_date.iso8601, timezone: "UTC")
      (data.dig("response") || [])
        .filter_map { |f| normalize_fixture(f) }
        .select     { |m| featured_league?(m) }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] matches_for_date(#{date}): #{e.message}")
    []
  end

  # Full match detail: fixture + events + lineups + stats + h2h in parallel.
  def match_detail(fixture_id)
    Rails.cache.fetch("live_scores_detail_v4_#{fixture_id}", expires_in: 30.seconds) do
      results = {}
      threads = {
        fixture: Thread.new { get("fixtures",            id:      fixture_id) },
        events:  Thread.new { get("fixtures/events",     fixture: fixture_id) },
        lineups: Thread.new { get("fixtures/lineups",    fixture: fixture_id) },
        stats:   Thread.new { get("fixtures/statistics", fixture: fixture_id) },
      }
      threads.each do |k, t|
        results[k] = t.join(10)&.value || {}
      rescue => e
        Rails.logger.warn("[LiveScoresClient] thread #{k}: #{e.message}")
        results[k] = {}
      end

      fx = results[:fixture].dig("response", 0)
      return nil unless fx

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
        h2h:      normalize_h2h(h2h_raw),
      }
    end
  rescue => e
    Rails.logger.error("[LiveScoresClient] match_detail(#{fixture_id}): #{e.message}")
    nil
  end

  # Tries today ±1 day date-list caches; builds a minimal fixture from list data.
  # Used as last-resort fallback when full detail API returns nothing.
  def match_from_list(match_id)
    [Date.today - 1, Date.today, Date.today + 1].each do |d|
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
    Rails.cache.fetch("live_scores_standings_v2_#{league_id}_#{season_id}", expires_in: 10.minutes) do
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
    data = get("players", search: query, season: season)
    data.dig("response") || []
  rescue => e
    Rails.logger.warn("[LiveScoresClient] search_players: #{e.message}")
    []
  end

  # ── Private ───────────────────────────────────────────────────────────────

  private

  def featured_league?(match)
    lid       = match[:league_id].to_i
    league    = match[:league_name].to_s
    home_team = match.dig(:home, :name).to_s
    away_team = match.dig(:away, :name).to_s

    # Exclude if league name OR either team name contains youth/women pattern.
    # e.g. "Finland U18 vs Norway U18" — age is in the team name, not the league.
    check = "#{league} #{home_team} #{away_team}"
    return false if check.match?(EXCLUDED_LEAGUE_PATTERN)

    # For World-level competitions, only show ones in our allowed ID list.
    # This prevents random low-tier friendlies (Cambodia vs Myanmar, etc.)
    # while still showing Copa América, Euro qualifiers, WC qualifiers, etc.
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
        red_cards: nil,
      },
      away: {
        name:      f.dig("teams", "away", "name"),
        logo:      f.dig("teams", "away", "logo"),
        score:     f.dig("goals", "away"),
        red_cards: nil,
      },
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
          "elapsed" => fx.dig("fixture", "status", "elapsed"),
        },
        "venue" => {
          "name" => fx.dig("fixture", "venue", "name"),
          "city" => fx.dig("fixture", "venue", "city"),
        },
      },
      "league" => {
        "id"      => fx.dig("league", "id"),
        "name"    => fx.dig("league", "name"),
        "logo"    => fx.dig("league", "logo"),
        "country" => fx.dig("league", "country"),
        "round"   => fx.dig("league", "round"),
      },
      "teams" => {
        "home" => {
          "id"     => fx.dig("teams", "home", "id"),
          "name"   => fx.dig("teams", "home", "name"),
          "logo"   => fx.dig("teams", "home", "logo"),
          "winner" => fx.dig("teams", "home", "winner"),
        },
        "away" => {
          "id"     => fx.dig("teams", "away", "id"),
          "name"   => fx.dig("teams", "away", "name"),
          "logo"   => fx.dig("teams", "away", "logo"),
          "winner" => fx.dig("teams", "away", "winner"),
        },
      },
      "goals" => {
        "home" => fx.dig("goals", "home"),
        "away" => fx.dig("goals", "away"),
      },
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
        comments: e["comments"],
      }
    end
  end

  def normalize_stats(raw)
    raw.map do |td|
      {
        team:  { name: td.dig("team", "name"), logo: td.dig("team", "logo") },
        stats: (td["statistics"] || []).map { |s| { type: s["type"], value: s["value"] } },
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
        coach:     t.dig("coach", "name"),
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
          score: fx.dig("goals", "home") || fx.dig("score", "fulltime", "home"),
        },
        away: {
          name:  fx.dig("teams", "away", "name"),
          logo:  fx.dig("teams", "away", "logo"),
          score: fx.dig("goals", "away") || fx.dig("score", "fulltime", "away"),
        },
        competition: { name: fx.dig("league", "name") },
      }
    end
    { summary: nil, matches: matches }
  end

  def build_detail_from_list(m)
    status_long = {
      "NS" => "Not Started", "1H" => "First Half", "HT" => "Half Time",
      "2H" => "Second Half", "ET" => "Extra Time",  "P"  => "Penalties",
      "FT" => "Full Time",  "AET" => "After Extra Time", "PEN" => "After Penalties",
    }
    short = m[:status_short] || (m[:status] == "finished" ? "FT" : m[:status] == "live" ? "1H" : "NS")

    fixture = {
      "fixture" => {
        "id"     => m[:external_id],
        "date"   => m[:kickoff_at],
        "status" => { "short" => short, "long" => status_long[short] || short, "elapsed" => m[:minute] },
        "venue"  => { "name" => m[:venue], "city" => nil },
      },
      "league" => {
        "id"      => m[:league_id],
        "name"    => m[:league_name],
        "logo"    => m[:league_logo],
        "country" => m[:league_country],
        "round"   => nil,
      },
      "teams" => {
        "home" => { "id" => nil, "name" => m.dig(:home, :name), "logo" => m.dig(:home, :logo), "winner" => nil },
        "away" => { "id" => nil, "name" => m.dig(:away, :name), "logo" => m.dig(:away, :logo), "winner" => nil },
      },
      "goals" => { "home" => m.dig(:home, :score), "away" => m.dig(:away, :score) },
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
