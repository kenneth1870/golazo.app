require "set"

class LiveScoresClient
  BASE_URL = "https://free-api-live-football-data.p.rapidapi.com/"
  HOST     = "free-api-live-football-data.p.rapidapi.com"

  STATUS_MAP = {
    1  => "scheduled",
    2  => "live",       # First half
    3  => "live",       # Second half
    4  => "live",       # Extra time
    5  => "live",       # Penalty shootout
    6  => "finished",   # Full time
    7  => "finished",   # After extra time
    8  => "finished",   # After penalties
    9  => "postponed",  # Postponed
    10 => "live",       # Half time
    11 => "live",       # Half time (alt)
    12 => "live",       # Break time
    13 => "live",       # Interrupted (suspended but not abandoned)
    14 => "postponed"  # Abandoned
  }.freeze

  STATUS_SHORT_MAP = {
    1  => "NS",
    2  => "1H",
    3  => "2H",
    4  => "ET",
    5  => "P",
    6  => "FT",
    7  => "AET",
    8  => "PEN",
    9  => "PPD",
    10 => "HT",
    11 => "HT",
    12 => "BT",
    13 => "INT",
    14 => "ABD"
  }.freeze

  def initialize
    key = ENV["RAPIDAPI_KEY"]
    raise "RAPIDAPI_KEY not configured" if key.blank?

    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-rapidapi-key"]  = key
      f.headers["x-rapidapi-host"] = HOST
      f.headers["Content-Type"]    = "application/json"
      f.request :retry, max: 2, interval: 1
      f.response :raise_error
    end
  end

  # Currently live matches across all leagues
  def live_matches
    data = get("football-current-live")
    data.dig("response", "live") || data.dig("response", "liveMatches") || []
  end

  # All matches for a given date, normalized to a common shape.
  # FotMob buckets matches by a European-offset date, so evening matches
  # (after ~18:00 UTC) appear in the *next* UTC day. We fetch both days
  # and merge; the frontend then filters by the user's local date.
  def matches_for_date(date)
    Rails.cache.fetch("live_scores_date_v8_#{date.to_date.iso8601}", expires_in: 5.minutes) do
      raw = fetch_raw_matches(date.to_date) + fetch_raw_matches(date.to_date + 1)
      raw.uniq! { |m| m["id"] || m["matchId"] }

      # Guard against date+1 scheduled matches leaking into today's view.
      # Allow through date 00:00 UTC → (date+1) 06:00 UTC so UTC-6 and earlier
      # users still see their local late-night matches, while morning matches
      # from the next calendar day are excluded.
      window_start = date.to_date.beginning_of_day.utc
      window_end   = (date.to_date + 1).beginning_of_day.utc + 6.hours
      raw.select! do |m|
        ts = m["startTimestamp"]
        next true unless ts
        t = Time.at(ts.to_i).utc
        t >= window_start && t < window_end
      end

      league_map = build_league_map(raw)
      raw.filter_map { |m| normalize_match(m, league_map) }
         .select { |m| featured_league?(m, league_map) }
    end
  end

  # Detailed match data using the correct `eventid` parameter.
  # Fetches detail, lineups, H2H, score, location in parallel threads.
  def match_detail(match_id)
    Rails.cache.fetch("live_scores_detail_v3_#{match_id}", expires_in: 30.seconds) do
      results = {}
      threads = {
        detail:   Thread.new { get("football-get-match-detail",    eventid: match_id) },
        home_lu:  Thread.new { get("football-get-hometeam-lineup", eventid: match_id) },
        away_lu:  Thread.new { get("football-get-awayteam-lineup", eventid: match_id) },
        h2h:      Thread.new { get("football-get-head-to-head",    eventid: match_id) },
        score:    Thread.new { get("football-get-match-score",     eventid: match_id) },
        status:   Thread.new { get("football-get-match-status",    eventid: match_id) },
        location: Thread.new { get("football-get-match-location",  eventid: match_id) },
        stats:    Thread.new { get("football-get-match-all-stats", eventid: match_id) }
      }
      threads.each do |k, t|
        results[k] = t.join(8)&.value || {}
      rescue => e
        Rails.logger.warn("[LiveScoresClient] thread #{k} error: #{e.message}")
        results[k] = {}
      end

      detail   = results[:detail].dig("response", "detail") || {}
      score    = results[:score].dig("response", "scores") || []
      status   = results[:status].dig("response", "status") || {}
      location = results[:location].dig("response", "location") || {}
      home_lu  = results[:home_lu].dig("response", "lineup")
      away_lu  = results[:away_lu].dig("response", "lineup")
      h2h_resp = results[:h2h].dig("response") || {}
      h2h_raw  = h2h_resp.dig("h2h") || h2h_resp.dig("content", "h2h") || h2h_resp.dig("headToHead") || {}
      stats_raw = results[:stats].dig("response")

      return nil if detail.blank? && score.empty?

      assemble_match_detail(detail, score, status, location, home_lu, away_lu, h2h_raw, stats_raw, match_id)
    end
  end

  # Finds a match in the cached date lists (today ± 1 day) and returns a
  # basic fixture detail built from list data. Used as a last-resort fallback
  # when the full detail API returns nothing.
  def match_from_list(match_id)
    [ Date.today - 1, Date.today, Date.today + 1 ].each do |d|
      list = matches_for_date(d)
      found = list.find { |m| m[:external_id].to_s == match_id.to_s }
      return build_detail_from_list(found) if found
    end
    nil
  rescue => e
    Rails.logger.warn("[LiveScoresClient] match_from_list #{match_id}: #{e.message}")
    nil
  end

  # Standings table for a league/season
  def league_standings(league_id, season_id)
    Rails.cache.fetch("live_scores_standings_#{league_id}_#{season_id}", expires_in: 10.minutes) do
      data = get("football-get-league-standing", leagueId: league_id, seasonId: season_id)
      data.dig("response", "standing") ||
        data.dig("response", "standings") || []
    end
  end

  # Top scorers for a league/season
  def top_scorers(league_id, season_id)
    Rails.cache.fetch("live_scores_scorers_#{league_id}_#{season_id}", expires_in: 30.minutes) do
      data = get("football-get-league-topscorers", leagueId: league_id, seasonId: season_id)
      data.dig("response", "topScorers") ||
        data.dig("response", "scorers") || []
    end
  end

  # All available leagues
  def leagues
    data = get("football-get-all-leagues")
    data.dig("response", "leagues") || []
  end

  # Search players by name
  def search_players(query)
    data = get("football-players-search", search: query)
    data.dig("response", "suggestions") || []
  end

  private

  # Known FotMob league IDs that don't appear in the all-leagues endpoint
  KNOWN_LEAGUES = {
    914609 => { name: "International Friendlies",   logo: nil, country: "INT" },
    925953 => { name: "Women's Friendlies",          logo: nil, country: "INT" },
    926232 => { name: "UEFA U-17 Championship",      logo: nil, country: "INT" },
    896469 => { name: "Asian Qualifiers",            logo: nil, country: "INT" },
    530    => { name: "Botola Pro (Morocco)",         logo: nil, country: "MAR" },
    516    => { name: "Ligue Pro (Algeria)",          logo: nil, country: "DZA" },
    8972   => { name: "USL Championship",            logo: nil, country: "USA" },
    9305   => { name: "Primera División (Argentina)", logo: nil, country: "ARG" },
    144    => { name: "Liga Boliviana",               logo: nil, country: "BOL" },
    344    => { name: "U-21 Friendlies",              logo: nil, country: "INT" },
    918053 => { name: "Division 3 (Sweden)",          logo: nil, country: "SWE" },
    931430 => { name: "Division 4 (Sweden)",          logo: nil, country: "SWE" },
    918043 => { name: "Division 4 (Sweden)",          logo: nil, country: "SWE" },
    916345 => { name: "USL League One",               logo: nil, country: "USA" },
    # Summer 2026 tournaments
    6      => { name: "Copa América 2026",            logo: nil, country: "INT" },
    940476 => { name: "FIFA Club World Cup 2025",     logo: nil, country: "INT" },
    936234 => { name: "Copa América 2026",            logo: nil, country: "INT" }
  }.freeze

  # League IDs that are explicitly excluded even if they pass other filters.
  EXCLUDED_LEAGUES = Set.new([
    926232,  # UEFA U-17 Championship
    344,     # U-21 Friendlies
    925953,  # Women's Friendlies
    896469  # Asian Qualifiers
  ]).freeze

  # Top domestic league IDs (FotMob IDs). Any league with country="INT" is
  # always included; these are the domestic leagues we also want to show.
  FEATURED_DOMESTIC_LEAGUES = Set.new([
    47,   # Premier League (England)
    87,   # La Liga (Spain)
    54,   # Bundesliga (Germany)
    55,   # Serie A (Italy)
    53,   # Ligue 1 (France)
    244,  # UEFA Champions League
    73,   # UEFA Europa League
    931,  # UEFA Conference League
    384,  # Eredivisie (Netherlands)
    332,  # Primeira Liga (Portugal)
    239,  # Liga MX (Mexico)
    133,  # Brasileirão (Brazil)
    108,  # Argentine Primera División
    242,  # MLS (USA)
    218,  # Scottish Premiership
    67,   # Süper Lig (Turkey)
    41,   # Championship (England)
    4,    # FIFA World Cup
    9,    # FIFA Women's World Cup
    137,  # Copa Libertadores
    138,  # Copa Sudamericana
    6,    # Copa América (recurring FotMob ID)
    940476, # FIFA Club World Cup 2025
    936234 # Copa América 2026 (alternate FotMob ID)
  ]).freeze

  # Builds a leagueId → {name, logo, country} map from the raw match list
  def build_league_map(raw_matches)
    ids = raw_matches.map { |m| m["leagueId"] }.compact.uniq
    return {} if ids.empty?

    all = Rails.cache.fetch("live_scores_all_leagues", expires_in: 24.hours) do
      data = get("football-get-all-leagues")
      (data.dig("response", "leagues") || []).each_with_object({}) { |l, h| h[l["id"]] = l }
    end

    ids.each_with_object({}) do |id, map|
      if (league = all[id])
        map[id] = { name: league["name"], logo: league["logo"], country: league["ccode"] }
      elsif (known = KNOWN_LEAGUES[id])
        map[id] = known
      else
        map[id] = { name: nil, logo: nil, country: "UNKNOWN" }
      end
    end
  end

  # Normalizes a match object (live or scheduled/finished) to the common shape
  # that controllers return to the frontend.
  def normalize_match(m, league_map = {})
    status_code = m.dig("status", "code") || m["statusId"] || m["status"]
    status      = STATUS_MAP[status_code.to_i]
    return nil if status.nil?

    minute_raw = m.dig("status", "liveTime", "long") || m.dig("status", "elapsed") || m["minute"]
    minute = minute_raw.to_s.include?(":") ? minute_raw.to_s.split(":").first.to_i : minute_raw.to_s.gsub(/[^\d]/, "").to_i.nonzero?
    lid      = m["leagueId"] || m.dig("league", "id")
    lg       = league_map[lid] || {}

    {
      external_id:    m["id"] || m["matchId"],
      league_id:      lid,
      league_name:    m.dig("league", "name") || m["leagueName"] || lg[:name],
      league_logo:    m.dig("league", "logo") || m["leagueLogo"] || lg[:logo],
      league_country: m.dig("league", "country") || m["country"] || lg[:country],
      kickoff_at:     begin
                        ts = m["startTimestamp"] || (m["timeTS"] && m["timeTS"] / 1000)
                        ts ? Time.at(ts).utc.iso8601 : (m["kickoff"] || m["date"])
                      end,
      status:         status,
      status_short:   STATUS_SHORT_MAP[status_code.to_i],
      minute:         minute,
      venue:          m.dig("venue", "name") || m["venue"],
      home: {
        name:      m.dig("home", "name")  || m.dig("homeTeam", "name"),
        logo:      team_logo(m.dig("home", "id") || m.dig("homeTeam", "id"), m.dig("home", "logo") || m.dig("homeTeam", "logo")),
        score:     m.dig("home", "score") || m.dig("homeScore", "current") || m["homeGoals"],
        red_cards: m.dig("home", "redCards")
      },
      away: {
        name:      m.dig("away", "name")      || m.dig("awayTeam", "name"),
        logo:      team_logo(m.dig("away", "id") || m.dig("awayTeam", "id"), m.dig("away", "logo") || m.dig("awayTeam", "logo")),
        score:     m.dig("away", "score")     || m.dig("awayScore", "current") || m["awayGoals"],
        red_cards: m.dig("away", "redCards")
      }
    }
  end

  # Normalizes a raw match-detail response into the shape MatchShowPage expects
  # that MatchShowPage.jsx expects.
  def normalize_detail(raw)
    status_code  = raw.dig("status", "code") || raw["statusId"]
    status_short = STATUS_SHORT_MAP[status_code.to_i] || "NS"
    elapsed      = raw.dig("status", "liveTime", "long") || raw.dig("status", "elapsed")

    home_score = raw.dig("home", "score") || raw.dig("homeScore", "current")
    away_score = raw.dig("away", "score") || raw.dig("awayScore", "current")
    home_wins  = home_score.to_i > away_score.to_i if home_score && away_score
    away_wins  = away_score.to_i > home_score.to_i if home_score && away_score

    fixture = {
      "fixture" => {
        "id"     => raw["id"] || raw["matchId"],
        "date"   => raw["startTimestamp"] ? Time.at(raw["startTimestamp"]).utc.iso8601 : raw["kickoff"],
        "status" => {
          "short"   => status_short,
          "long"    => raw.dig("status", "description") || status_short,
          "elapsed" => elapsed
        },
        "venue" => { "name" => raw.dig("venue", "name") || raw["venue"], "city" => nil }
      },
      "league" => {
        "id"      => raw["leagueId"] || raw.dig("league", "id"),
        "name"    => raw.dig("league", "name") || raw["leagueName"],
        "logo"    => raw.dig("league", "logo"),
        "country" => raw.dig("league", "country") || raw["country"],
        "round"   => raw["round"] || raw["roundName"]
      },
      "teams" => {
        "home" => {
          "id"     => raw.dig("home", "id") || raw.dig("homeTeam", "id"),
          "name"   => raw.dig("home", "name") || raw.dig("homeTeam", "name"),
          "logo"   => raw.dig("home", "logo") || raw.dig("homeTeam", "logo"),
          "winner" => home_wins
        },
        "away" => {
          "id"     => raw.dig("away", "id") || raw.dig("awayTeam", "id"),
          "name"   => raw.dig("away", "name") || raw.dig("awayTeam", "name"),
          "logo"   => raw.dig("away", "logo") || raw.dig("awayTeam", "logo"),
          "winner" => away_wins
        }
      },
      "goals" => {
        "home" => home_score,
        "away" => away_score
      }
    }

    events  = normalize_events(raw["events"] || raw["incidents"] || [])
    stats   = normalize_stats(raw["stats"] || raw["statistics"] || [])
    lineups = normalize_lineups(raw["lineups"] || [])

    { fixture: fixture, events: events, stats: stats, lineups: lineups }
  end

  def normalize_events(raw)
    raw.map do |e|
      type   = infer_event_type(e["type"] || e["incidentType"])
      detail = e["detail"] || e["incidentClass"] || type

      {
        minute:   e["time"] || e.dig("time", "elapsed") || e["minute"],
        extra:    e.dig("time", "extra"),
        team:     { name: e.dig("team", "name") || e["teamName"], logo: e.dig("team", "logo") },
        player:   e.dig("player", "name") || e["playerName"],
        assist:   e.dig("assist", "name") || e["assistName"],
        type:     type,
        detail:   detail,
        comments: e["comments"]
      }
    end
  end

  def normalize_stats(raw)
    return [] unless raw.is_a?(Array)
    raw.map do |team_data|
      stats_raw = team_data["statistics"] || team_data["stats"] || []
      {
        team:  { name: team_data.dig("team", "name") || team_data["teamName"],
                 logo: team_data.dig("team", "logo") },
        stats: stats_raw.map { |s| { type: s["type"] || s["name"], value: s["value"] } }
      }
    end
  end

  def normalize_lineups(raw)
    return [] unless raw.is_a?(Array)
    raw.map do |t|
      {
        team:      { name: t.dig("team", "name"), logo: t.dig("team", "logo"), colors: t.dig("team", "colors") },
        formation: t["formation"],
        start_xi:  (t["startXI"] || t["startingXI"] || []).map { |p|
          { name: p.dig("player", "name"), number: p.dig("player", "number"),
            pos: p.dig("player", "pos"), grid: p.dig("player", "grid") }
        },
        subs:      (t["substitutes"] || t["subs"] || []).map { |p|
          { name: p.dig("player", "name"), number: p.dig("player", "number"), pos: p.dig("player", "pos") }
        },
        coach:     t.dig("coach", "name")
      }
    end
  end

  def infer_event_type(raw_type)
    return "Goal"  if raw_type.to_s.match?(/goal/i)
    return "Card"  if raw_type.to_s.match?(/card|yellow|red/i)
    return "subst" if raw_type.to_s.match?(/sub|substitut/i)
    raw_type.to_s
  end

  POSITION_MAP = {
    11 => "G",                          # GK
    (30..59) => "D",                    # Defenders
    (60..99) => "M",                    # Midfielders
    (100..149) => "F"                  # Forwards
  }.freeze

  def fetch_raw_matches(date)
    data = get("football-get-matches-by-date", date: date.strftime("%Y%m%d"))
    data.dig("response", "matches") ||
      data.dig("response", "fixtures") ||
      data.dig("response", "live") || []
  rescue => e
    Rails.logger.warn("[LiveScoresClient] fetch_raw_matches #{date} failed: #{e.message}")
    []
  end

  def featured_league?(match, league_map)
    lid     = match[:league_id]
    country = match[:league_country] || league_map.dig(lid, :country)
    name    = (match[:league_name] || "").downcase
    home    = (match.dig(:home, :name) || "").downcase
    away    = (match.dig(:away, :name) || "").downcase

    return false if EXCLUDED_LEAGUES.include?(lid.to_i)
    return false if name.include?("women") || name.include?("female") || name.include?("girl")
    return false if home.end_with?("(w)") || away.end_with?("(w)")

    return true if country == "INT"
    FEATURED_DOMESTIC_LEAGUES.include?(lid.to_i)
  end

  def team_logo(id, fallback = nil)
    return fallback if fallback.present?
    return nil unless id.present?
    "https://images.fotmob.com/image_resources/logo/teamlogo/#{id}_large.png"
  end

  def pos_from_id(position_id)
    return "G" if position_id == 11
    return "D" if position_id&.between?(30, 59)
    return "M" if position_id&.between?(60, 99)
    return "F" if position_id&.between?(100, 149)
    "M"
  end

  def pos_from_y(y)
    return "G" if y.to_f < 0.2
    return "D" if y.to_f < 0.5
    return "M" if y.to_f < 0.75
    "F"
  end

  def normalize_lineup_team(lu)
    return nil unless lu
    starters = (lu["starters"] || []).map do |p|
      y = p.dig("verticalLayout", "y")
      x = p.dig("verticalLayout", "x")
      pos = pos_from_id(p["positionId"]) || pos_from_y(y)
      { name: p["name"], number: p["shirtNumber"]&.to_i, pos: pos, grid: nil, x: x, y: y }
    end

    # Assign grid rows by clustering y values
    rows = starters.map { |p| p[:y].to_f }.uniq.sort
    starters.each do |p|
      row_idx = rows.index(p[:y].to_f) || 0
      row_players = starters.select { |q| q[:y] == p[:y] }.sort_by { |q| q[:x].to_f }
      col_idx = row_players.index(p) || 0
      p[:grid] = "#{row_idx + 1}:#{col_idx + 1}"
    end

    subs = (lu["subs"] || []).map do |p|
      pos = pos_from_id(p["positionId"])
      { name: p["name"], number: p["shirtNumber"]&.to_i, pos: pos }
    end

    {
      team:      { name: lu["name"], logo: "https://images.fotmob.com/image_resources/logo/teamlogo/#{lu['id']}_large.png", colors: nil },
      formation: lu["formation"],
      start_xi:  starters,
      subs:      subs,
      coach:     nil
    }
  end

  def normalize_h2h(h2h_raw, home_id, away_id)
    return { summary: nil, matches: [] } if h2h_raw.blank?
    summary = h2h_raw["summary"]
    matches = (h2h_raw["matches"] || []).map do |m|
      score_str = m.dig("status", "scoreStr") || ""
      parts = score_str.split("-").map(&:strip)
      {
        kickoff_at: m.dig("time", "utcTime"),
        status:     m.dig("status", "finished") ? "finished" : "scheduled",
        home: { name: m.dig("home", "name"), score: parts[0]&.to_i },
        away: { name: m.dig("away", "name"), score: parts[1]&.to_i },
        competition: { name: m.dig("league", "name") }
      }
    end
    { summary: summary, matches: matches }
  end

  def normalize_stats_response(stats_raw, home_name, away_name)
    return [] unless stats_raw.is_a?(Hash)
    home_stats = stats_raw["homeTeamStats"] || stats_raw["home"] || {}
    away_stats = stats_raw["awayTeamStats"] || stats_raw["away"] || {}
    return [] if home_stats.blank? && away_stats.blank?

    stat_keys = (home_stats.keys + away_stats.keys).uniq
    [
      {
        team: { name: home_name },
        stats: stat_keys.map { |k| { type: k.to_s.humanize, value: home_stats[k] } }
      },
      {
        team: { name: away_name },
        stats: stat_keys.map { |k| { type: k.to_s.humanize, value: away_stats[k] } }
      }
    ]
  end

  def assemble_match_detail(detail, score, status, location, home_lu, away_lu, h2h_raw, stats_raw, match_id)
    home_score_obj = score.first || {}
    away_score_obj = score.last || {}
    home_name = detail.dig("homeTeam", "name") || home_score_obj["name"]
    away_name = detail.dig("awayTeam", "name") || away_score_obj["name"]
    home_id   = detail.dig("homeTeam", "id") || home_score_obj["id"]
    away_id   = detail.dig("awayTeam", "id") || away_score_obj["id"]

    finished = status["finished"] || detail["finished"]
    started  = status["started"]  || detail["started"]
    short = if !started then "NS"
    elsif status.dig("reason", "short") then status.dig("reason", "short")
    elsif finished then "FT"
    else "1H"
    end

    long_status = status.dig("reason", "long") || (finished ? "Full Time" : started ? "In Progress" : "Not Started")
    elapsed = nil
    if started && !finished
      # Prefer real live time from status; fall back to period defaults
      raw_time = status.dig("liveTime", "long") || status["elapsed"] || detail.dig("status", "liveTime", "long")
      if raw_time
        elapsed = raw_time.to_s.include?(":") ? raw_time.to_s.split(":").first.to_i : raw_time.to_s.gsub(/[^\d]/, "").to_i.nonzero?
      end
      elapsed ||= (short == "HT" ? 45 : nil)
    end

    home_logo = "https://images.fotmob.com/image_resources/logo/teamlogo/#{home_id}_large.png"
    away_logo = "https://images.fotmob.com/image_resources/logo/teamlogo/#{away_id}_large.png"
    league_logo = "https://images.fotmob.com/image_resources/logo/leaguelogo/dark/#{detail['leagueId']}.png"
    home_wins = finished && home_score_obj["score"].to_i > away_score_obj["score"].to_i
    away_wins = finished && away_score_obj["score"].to_i > home_score_obj["score"].to_i

    fixture = {
      "fixture" => {
        "id"     => match_id,
        "date"   => detail["matchTimeUTCDate"] || status["utcTime"],
        "status" => { "short" => short, "long" => long_status, "elapsed" => elapsed },
        "venue"  => { "name" => location["name"], "city" => location["city"] }
      },
      "league" => {
        "id"      => detail["leagueId"],
        "name"    => detail["leagueName"],
        "logo"    => league_logo,
        "country" => detail["countryCode"],
        "round"   => detail["leagueRoundName"]
      },
      "teams" => {
        "home" => { "id" => home_id, "name" => home_name, "logo" => home_logo, "winner" => home_wins },
        "away" => { "id" => away_id, "name" => away_name, "logo" => away_logo, "winner" => away_wins }
      },
      "goals" => {
        "home" => home_score_obj["score"],
        "away" => away_score_obj["score"]
      }
    }

    # Lineups from separate endpoints; fall back to embedded detail["lineups"]
    lineups = [ normalize_lineup_team(home_lu), normalize_lineup_team(away_lu) ].compact
    lineups = normalize_lineups(detail["lineups"] || []) if lineups.empty? && detail["lineups"].present?

    h2h = normalize_h2h(h2h_raw, home_id, away_id)

    # Stats: API returns Array of team-stat objects; normalize_stats handles that.
    # normalize_stats_response handles legacy Hash format.
    stats = stats_raw.is_a?(Array) ? normalize_stats(stats_raw) : normalize_stats_response(stats_raw, home_name, away_name)
    # Fallback: stats embedded directly in match detail response
    if stats.empty?
      inline = detail["stats"] || detail["statistics"] || []
      stats  = inline.is_a?(Array) ? normalize_stats(inline) : normalize_stats_response(inline, home_name, away_name)
    end

    # Events: FotMob may wrap in a Hash like {"ongoing":[...],"aggregated":[...]};
    # find the first Array value, or try incidents directly.
    events_arr = [ detail["events"], detail["incidents"] ].find { |e| e.is_a?(Array) }
    if events_arr.nil?
      ev         = detail["events"] || detail["incidents"]
      events_arr = ev.is_a?(Hash) ? (ev.values.find { |v| v.is_a?(Array) } || []) : []
    end
    events = normalize_events(events_arr)

    Rails.logger.debug("[MatchDetail #{match_id}] stats=#{stats_raw.class} events_src=#{(detail['events'] || detail['incidents']).class} lineups=#{lineups.length} h2h_matches=#{h2h[:matches]&.length || 0}")

    { fixture: fixture, events: events, stats: stats, lineups: lineups, h2h: h2h }
  end

  # Normalized live matches keyed by external_id, for fallback lookups
  def live_matches_normalized
    live_matches.filter_map { |m| normalize_match(m) }
  rescue
    []
  end

  # Build a basic fixture detail from a normalized list match (no events/stats/lineups)
  def build_detail_from_list(m)
    status_short_to_long = {
      "NS" => "Not Started", "1H" => "First Half", "HT" => "Half Time",
      "2H" => "Second Half", "ET" => "Extra Time", "P"  => "Penalties",
      "FT" => "Full Time", "AET" => "After Extra Time", "PEN" => "After Penalties"
    }
    short = m[:status_short] || (m[:status] == "finished" ? "FT" : m[:status] == "live" ? "1H" : "NS")
    elapsed = m[:minute].is_a?(Integer) ? m[:minute] : m[:minute].to_s.split(":").first.to_i.nonzero?

    fixture = {
      "fixture" => {
        "id"     => m[:external_id],
        "date"   => m[:kickoff_at],
        "status" => { "short" => short, "long" => status_short_to_long[short] || short, "elapsed" => elapsed },
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
  rescue Faraday::Error, JSON::ParserError => e
    Rails.logger.error("[LiveScoresClient] #{path}: #{e.message}")
    Sentry.capture_exception(e, extra: { path: path }) if defined?(Sentry) && Sentry.initialized?
    {}
  end
end
