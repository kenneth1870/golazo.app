class WorldCupSync
  # WC 2026 league/season IDs on free-api-live-football-data.p.rapidapi.com
  # Override via ENV if the API uses different IDs.
  WC_LEAGUE_ID = (ENV["RAPIDAPI_WC_LEAGUE_ID"] || 1).to_i
  WC_SEASON_ID = (ENV["RAPIDAPI_WC_SEASON_ID"] || 2026).to_i

  STATUS_MAP = {
    1  => "scheduled",
    2  => "live", 3 => "live", 4 => "live", 5 => "live",
    6  => "finished", 7 => "finished", 8 => "finished",
    11 => "live", 12 => "live",
  }.freeze

  def initialize(competition_code: "WC")
    @api  = LiveScoresClient.new
    @code = competition_code
    @log  = Rails.logger
  end

  # Sync all live matches across all leagues, updating DB records matched by team name
  def sync_live
    matches = @api.live_matches
    return log("No live matches") if matches.empty?

    log("Live: #{matches.length} matches")
    updated = 0
    matches.each { |raw| updated += 1 if sync_match_from_live(raw) }
    log("Updated #{updated} matches")
  end

  # Sync today's matches (scheduled + live + finished today)
  def sync_today
    matches = @api.matches_for_date(Date.today)
    return log("No matches today") if matches.empty?

    log("Today: #{matches.length} matches")
    updated = 0
    matches.each { |m| updated += 1 if sync_match_from_normalized(m) }
    log("Updated #{updated} matches")
  end

  # Sync standings for the WC competition using the RapidAPI standings endpoint
  def sync_standings(competition = nil)
    competition ||= Competition.find_by!(code: @code)

    groups = @api.league_standings(WC_LEAGUE_ID, WC_SEASON_ID)
    return log("No standings data returned") if groups.empty?

    log("Standings: #{groups.length} entries")
    groups.each { |entry| upsert_standing(entry, competition) }
  end

  # Legacy full sync — teams and fixtures come from DB seeds for WC 2026.
  # Only live/today sync and standings are updated from the API.
  def sync_all
    log("Sync all: #{@code} (standings + today)")
    competition = Competition.find_by(code: @code)
    unless competition
      log("Competition #{@code} not found in DB — run seeds first")
      return
    end
    sync_standings(competition)
    sync_today
    log("Done")
  end

  private

  # Updates a DB match from a live-endpoint raw match object
  def sync_match_from_live(raw)
    home_name  = raw.dig("home", "name") || raw.dig("home", "longName")
    away_name  = raw.dig("away", "name") || raw.dig("away", "longName")
    return false unless home_name && away_name

    home_score = raw.dig("home", "score")
    away_score = raw.dig("away", "score")
    minute     = raw.dig("status", "liveTime", "long")

    match = find_match_by_teams(home_name, away_name)
    return false unless match
    return false if home_score == match.home_score && away_score == match.away_score

    match.update!(status: "live", home_score: home_score, away_score: away_score)
    broadcast_score(match, minute)
    true
  rescue => e
    log("Live sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  # Updates a DB match from a normalized match hash (from matches_for_date)
  def sync_match_from_normalized(m)
    home_name = m[:home]&.dig(:name) || m.dig(:home, "name")
    away_name = m[:away]&.dig(:name) || m.dig(:away, "name")
    return false unless home_name && away_name

    status     = m[:status]
    home_score = m.dig(:home, :score)
    away_score = m.dig(:away, :score)

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    attrs = { status: status }
    attrs[:home_score] = home_score unless status == "scheduled"
    attrs[:away_score] = away_score unless status == "scheduled"

    match.update!(attrs)
    broadcast_score(match, m[:minute]) if status == "live"
    true
  rescue => e
    log("Today sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  def upsert_standing(entry, competition)
    # Attempt to match by team name since external_ids may differ across APIs
    team_name = entry.dig("team", "name") || entry["teamName"]
    return unless team_name

    team = Team.where(competition_id: nil)
               .where("LOWER(name) = ?", team_name.downcase)
               .first
    team ||= Team.where("LOWER(name) LIKE ?", "%#{team_name.downcase.split.first}%").first
    return unless team

    Standing.find_or_initialize_by(team: team, competition: competition).tap do |s|
      s.group_name    = entry["group"] || entry["groupName"]
      s.rank          = entry["position"] || entry["rank"]
      s.played        = entry["played"] || entry["playedGames"]
      s.won           = entry["won"]
      s.drawn         = entry["drawn"] || entry["draw"]
      s.lost          = entry["lost"]
      s.goals_for     = entry["goalsFor"] || entry["scored"]
      s.goals_against = entry["goalsAgainst"] || entry["conceded"]
      s.points        = entry["points"]
      s.save!
    end
  rescue => e
    log("Standing upsert error for #{team_name}: #{e.message}")
  end

  def find_match_by_teams(home_name, away_name)
    Match.joins(:home_team, :away_team)
         .where(status: %w[scheduled live])
         .find_by(
           "LOWER(home_teams_matches.name) = ? AND LOWER(away_teams_matches.name) = ?",
           home_name.downcase, away_name.downcase
         )
  rescue => e
    log("Match lookup error: #{e.message}")
    nil
  end

  def broadcast_score(match, minute = nil)
    ActionCable.server.broadcast("match_#{match.id}", {
      type:       "score_update",
      home_score: match.home_score,
      away_score: match.away_score,
      status:     match.status,
      minute:     minute,
    })
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
