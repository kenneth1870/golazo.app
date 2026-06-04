class ApiSportsClient
  BASE_URL = "https://v3.football.api-sports.io/"

  # Allowlist of meaningful league IDs (api-sports.io)
  PRIORITY_IDS = [
    # Continental / World
    2, 3, 5,          # UCL, Europa League, UEFA Super Cup
    10,               # International Friendlies (A-team)
    77, 78,           # World Cup (various)
    44, 51,           # Copa América, Gold Cup
    45, 299,          # Copa Libertadores, Copa Sudamericana
    298, 9821,        # CONCACAF Gold Cup, Nations League
    289,              # Africa Cup of Nations
    50, 288,          # EURO, UEFA U21
    # Big 5 + top domestic
    39, 40,           # Premier League, Championship
    61, 66,           # Ligue 1, Coupe de France
    71, 73,           # Brazil Série A, Copa do Brasil
    78, 79, 90,       # Bundesliga, 2. Bundesliga, DFB-Pokal
    135, 137,         # Serie A, Coppa Italia
    140, 143,         # La Liga, Copa del Rey
    94, 95,           # Primeira Liga (Portugal), Taça
    88, 89,           # Eredivisie, KNVB Cup
    144, 145,         # Belgian Pro League, Belgian Cup
    179, 183,         # Scottish Premiership, Scottish Cup
    # Americas
    128, 130,         # Copa Argentina, TAS Argentina
    239, 240,         # Colombia Primera A, Copa Colombia
    253, 254,         # MLS, US Open Cup
    479,              # Canadian Premier League
    262, 263,         # Liga MX, Copa MX
    612,              # Brazil Copa do Nordeste
    # Asia / Oceania (high profile)
    292, 309,         # K League 1, J1 League
    # Clubs (World)
    914,              # Tournoi Maurice Revello (int'l U20)
  ].freeze

  STATUS_MAP = {
    "1H" => "live",  "2H" => "live",  "HT" => "live",
    "ET" => "live",  "BT" => "live",  "P"  => "live",
    "FT" => "finished", "AET" => "finished", "PEN" => "finished",
    "AWD" => "finished",
    "NS"  => "scheduled",
    "PST" => "scheduled", "CANC" => nil, "ABD" => nil,
  }.freeze

  def initialize
    key = ENV["FOOTBALL_API_KEY"]
    raise "FOOTBALL_API_KEY not set" if key.blank?

    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-apisports-key"] = key
      f.headers["Accept"]          = "application/json"
      f.request :retry, max: 1, interval: 1
      f.response :raise_error
    end
  end

  def today_matches
    matches_for_date(Date.today)
  end

  def matches_for_date(date)
    date = date.to_date
    cache_ttl = date == Date.today ? 5.minutes : 30.minutes
    Rails.cache.fetch("api_sports_date_#{date.iso8601}", expires_in: cache_ttl) do
      raw = get("fixtures", date: date.iso8601)["response"] || []
      raw
        .filter_map { |f| normalize(f) }
        .select { |m| relevant?(m) }
        .sort_by { |m| [status_order(m[:status]), m[:kickoff_at]] }
    end
  end

  def fixture_detail(fixture_id)
    cache_key = "api_sports_fixture_#{fixture_id}"

    # Return cached result if present (only stored when fixture was found)
    cached = Rails.cache.read(cache_key)
    return cached if cached

    fixture = get("fixtures", id: fixture_id)["response"]&.first

    # Don't cache a nil fixture — let the next request retry the API
    return { fixture: nil, stats: [], events: [], lineups: [] } if fixture.nil?

    status_short = fixture.dig("fixture", "status", "short")
    finished     = %w[FT AET PEN].include?(status_short)
    live         = %w[1H 2H HT ET BT P].include?(status_short)

    stats   = get("fixtures/statistics", fixture: fixture_id)["response"] || []
    events  = get("fixtures/events",     fixture: fixture_id)["response"] || []
    lineups = get("fixtures/lineups",    fixture: fixture_id)["response"] || []

    data = {
      fixture: fixture,
      stats:   normalize_stats(stats),
      events:  normalize_events(events),
      lineups: normalize_lineups(lineups),
    }

    # Cache finished matches for 24 h, live for 30 s, pre-match for 5 min
    ttl = finished ? 24.hours : live ? 30.seconds : 5.minutes
    Rails.cache.write(cache_key, data, expires_in: ttl)

    data
  end

  def fixture_preview(home_team_id, away_team_id)
    h2h_key = [home_team_id, away_team_id].sort.join("-")
    Rails.cache.fetch("api_sports_preview_#{h2h_key}", expires_in: 30.minutes) do
      h2h_raw  = get("fixtures", h2h: "#{home_team_id}-#{away_team_id}", last: 5)["response"] || []
      home_raw = get("fixtures", team: home_team_id, last: 5)["response"] || []
      away_raw = get("fixtures", team: away_team_id, last: 5)["response"] || []

      {
        h2h:       h2h_raw.filter_map  { |f| normalize_preview(f) }.first(5),
        home_form: home_raw.filter_map { |f| normalize_preview(f) }.first(5),
        away_form: away_raw.filter_map { |f| normalize_preview(f) }.first(5),
      }
    end
  end

  def live_matches
    Rails.cache.fetch("api_sports_live", expires_in: 1.minute) do
      raw = get("fixtures", live: "all")["response"] || []
      raw
        .filter_map { |f| normalize(f) }
        .select { |m| relevant?(m) }
        .sort_by { |m| m[:minute].to_i }
    end
  end

  private

  def relevant?(m)
    return false if m[:status].nil?
    PRIORITY_IDS.include?(m[:league_id])
  end

  def status_order(status)
    { "live" => 0, "scheduled" => 1, "finished" => 2 }.fetch(status, 3)
  end

  def normalize(f)
    status_short = f.dig("fixture", "status", "short")
    status       = STATUS_MAP[status_short]
    return nil if status.nil?

    {
      external_id:     f.dig("fixture", "id"),
      league_id:       f.dig("league", "id"),
      league_name:     f.dig("league", "name"),
      league_logo:     f.dig("league", "logo"),
      league_country:  f.dig("league", "country"),
      kickoff_at:      f.dig("fixture", "date"),
      status:          status,
      status_short:    status_short,
      minute:          f.dig("fixture", "status", "elapsed"),
      venue:           f.dig("fixture", "venue", "name"),
      home: {
        name:  f.dig("teams", "home", "name"),
        logo:  f.dig("teams", "home", "logo"),
        score: f.dig("goals", "home"),
      },
      away: {
        name:  f.dig("teams", "away", "name"),
        logo:  f.dig("teams", "away", "logo"),
        score: f.dig("goals", "away"),
      },
    }
  end

  def normalize_preview(f)
    m = normalize(f)
    return nil unless m
    m.merge(
      home_team_id: f.dig("teams", "home", "id"),
      away_team_id: f.dig("teams", "away", "id"),
    )
  end

  def normalize_stats(raw)
    raw.map do |team_data|
      {
        team: { name: team_data.dig("team", "name"), logo: team_data.dig("team", "logo") },
        stats: team_data["statistics"]&.map { |s| { type: s["type"], value: s["value"] } } || [],
      }
    end
  end

  def normalize_events(raw)
    raw.map do |e|
      {
        minute:  e.dig("time", "elapsed"),
        extra:   e.dig("time", "extra"),
        team:    { name: e.dig("team", "name"), logo: e.dig("team", "logo") },
        player:  e.dig("player", "name"),
        assist:  e.dig("assist", "name"),
        type:    e["type"],
        detail:  e["detail"],
        comments: e["comments"],
      }
    end
  end

  def normalize_lineups(raw)
    raw.map do |t|
      {
        team:    { name: t.dig("team", "name"), logo: t.dig("team", "logo"), colors: t.dig("team", "colors") },
        formation: t["formation"],
        start_xi: (t["startXI"] || []).map { |p| { name: p.dig("player", "name"), number: p.dig("player", "number"), pos: p.dig("player", "pos"), grid: p.dig("player", "grid") } },
        subs:     (t["substitutes"] || []).map { |p| { name: p.dig("player", "name"), number: p.dig("player", "number"), pos: p.dig("player", "pos") } },
        coach:    t.dig("coach", "name"),
      }
    end
  end

  def get(path, params = {})
    resp = @conn.get(path, params)
    JSON.parse(resp.body)
  rescue Faraday::Error => e
    Rails.logger.error("[ApiSportsClient] #{e.class}: #{e.message}")
    {}
  end
end
