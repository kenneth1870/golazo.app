class ApiSportsClient
  BASE_URL = "https://v3.football.api-sports.io/"

  def initialize
    # Read the key at call-time so a missing var surfaces as a runtime error
    # rather than being permanently nil from the moment the class was loaded.
    token = ENV["APISPORTS_KEY"].presence
    raise "APISPORTS_KEY env var not set" if token.blank?
    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-apisports-key"] = token
      f.options.timeout      = 10
      f.options.open_timeout = 6
      # Retry transient failures so a single network blip doesn't poison the
      # 30-minute cache with an empty response.
      f.request :retry, max: 2, interval: 0.5, exceptions: [
        Faraday::TimeoutError, Faraday::ConnectionFailed, Faraday::ServerError
      ]
    end
  end

  # Main entry: given a match's home name, away name, and kickoff time,
  # return fully populated { fixture, events, stats, lineups, h2h } or nil.
  def match_detail(home_name:, away_name:, kickoff_at:)
    date = parse_date(kickoff_at)
    return nil unless date

    fixture_id = find_fixture_id(home_name, away_name, date)
    return nil unless fixture_id

    Rails.logger.info("[ApiSportsClient] using fixture_id=#{fixture_id} for #{home_name} vs #{away_name}")

    Rails.cache.fetch("apisports_detail_#{fixture_id}", expires_in: 30.minutes, race_condition_ttl: 15.seconds) do
      fetch_full_detail(fixture_id)
    end
  end

  private

  # ── Fixture search ────────────────────────────────────────────────────────

  def find_fixture_id(home_name, away_name, date)
    cache_key = "apisports_fid_#{Digest::SHA1.hexdigest("#{home_name}-#{away_name}-#{date}")}"
    Rails.cache.fetch(cache_key, expires_in: 7.days, race_condition_ttl: 60.seconds) do
      season = date.year
      # Try current year first, then previous (matches played late Dec / early Jan)
      [ season, season - 1 ].each do |s|
        data = get("fixtures", date: date.iso8601, season: s, timezone: "UTC")
        fixtures = data.dig("response") || []
        found = fuzzy_match(fixtures, home_name, away_name)
        return found.dig("fixture", "id") if found
      end
      nil
    end
  rescue => e
    Rails.logger.warn("[ApiSportsClient] find_fixture_id: #{e.message}")
    nil
  end

  def fuzzy_match(fixtures, home_name, away_name)
    home_tokens = tokenize(home_name)
    away_tokens = tokenize(away_name)

    fixtures.find do |f|
      h = f.dig("teams", "home", "name").to_s.downcase
      a = f.dig("teams", "away", "name").to_s.downcase
      home_tokens.any? { |t| h.include?(t) } && away_tokens.any? { |t| a.include?(t) }
    end
  end

  def tokenize(name)
    name.downcase.split(/[\s\-\.]+/).select { |t| t.length > 2 }
  end

  # ── Full detail fetch ─────────────────────────────────────────────────────

  def fetch_full_detail(fixture_id)
    results = {}
    threads = {
      fixture: Thread.new { get("fixtures", id: fixture_id) },
      events:  Thread.new { get("fixtures/events",     fixture: fixture_id) },
      stats:   Thread.new { get("fixtures/statistics", fixture: fixture_id) },
      lineups: Thread.new { get("fixtures/lineups",    fixture: fixture_id) }
    }
    threads.each do |k, t|
      results[k] = t.join(10)&.value || {}
    rescue => e
      Rails.logger.warn("[ApiSportsClient] thread #{k}: #{e.message}")
      results[k] = {}
    end

    fx = results[:fixture].dig("response", 0)
    return nil unless fx

    home_id = fx.dig("teams", "home", "id")
    away_id = fx.dig("teams", "away", "id")

    # H2H — needs team IDs from fixture, fetch after
    h2h_raw = if home_id && away_id
      get("fixtures/headtohead", h2h: "#{home_id}-#{away_id}", last: 10)
        .dig("response") || []
    else
      []
    end

    {
      fixture:  build_fixture(fx),
      events:   normalize_events(results[:events].dig("response") || []),
      stats:    normalize_stats(results[:stats].dig("response") || []),
      lineups:  normalize_lineups(results[:lineups].dig("response") || []),
      h2h:      normalize_h2h(h2h_raw, home_id, away_id)
    }
  end

  # ── Builders ──────────────────────────────────────────────────────────────

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
        "venue"  => {
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
      type = e["type"].to_s
      {
        minute:   e.dig("time", "elapsed"),
        extra:    e.dig("time", "extra"),
        team:     { name: e.dig("team", "name"), logo: e.dig("team", "logo") },
        player:   e.dig("player", "name"),
        assist:   e.dig("assist", "name"),
        type:     type,
        detail:   e["detail"] || type,
        comments: e["comments"]
      }
    end
  end

  def normalize_stats(raw)
    raw.map do |team_data|
      {
        team:  { name: team_data.dig("team", "name"), logo: team_data.dig("team", "logo") },
        stats: (team_data["statistics"] || []).map { |s| { type: s["type"], value: s["value"] } }
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

  def normalize_h2h(raw, home_id, away_id)
    matches = raw.map do |fx|
      home_goals = fx.dig("goals", "home") || fx.dig("score", "fulltime", "home")
      away_goals = fx.dig("goals", "away") || fx.dig("score", "fulltime", "away")
      status_short = fx.dig("fixture", "status", "short") || "FT"
      {
        kickoff_at:  fx.dig("fixture", "date"),
        status:      fx.dig("fixture", "status", "long") || "Finished",
        home:        { name: fx.dig("teams", "home", "name"), logo: fx.dig("teams", "home", "logo"), score: home_goals },
        away:        { name: fx.dig("teams", "away", "name"), logo: fx.dig("teams", "away", "logo"), score: away_goals },
        competition: { name: fx.dig("league", "name") }
      }
    end
    { summary: nil, matches: matches }
  end

  # ── HTTP ─────────────────────────────────────────────────────────────────

  def get(path, params = {})
    resp = @conn.get(path, params)
    JSON.parse(resp.body)
  rescue => e
    Rails.logger.warn("[ApiSportsClient] GET #{path}: #{e.message}")
    {}
  end

  def parse_date(kickoff_at)
    return nil if kickoff_at.blank?
    Time.parse(kickoff_at.to_s).utc.to_date
  rescue
    nil
  end
end
