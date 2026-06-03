class WorldCupSync
  def initialize
    @api = FootballDataClient.new
    @log = Rails.logger
  end

  def sync_all
    log "Starting full WC 2026 sync..."
    sync_teams
    sync_fixtures
    sync_standings
    log "Done. Teams: #{Team.count}, Matches: #{Match.count}, Standings: #{Standing.count}"
  end

  def sync_live
    matches = @api.live_matches
    return log("No live matches right now") if matches.empty?
    log "Syncing #{matches.length} live matches..."
    matches.each { |m| sync_match(m) }
  end

  def sync_today
    matches = @api.today_matches
    log "Today's matches: #{matches.length}"
    matches.each { |m| sync_match(m) }
  end

  def sync_standings
    groups = @api.standings
    log "Syncing #{groups.length} groups..."

    groups.each do |group|
      group_label = group["group"]&.gsub("GROUP_", "") || "?"
      (group["table"] || []).each do |entry|
        team = Team.find_by(external_id: entry.dig("team", "id"))
        next unless team

        Standing.find_or_initialize_by(team: team).tap do |s|
          s.group_name    = group_label
          s.rank          = entry["position"]
          s.played        = entry["playedGames"]
          s.won           = entry["won"]
          s.drawn         = entry["draw"]
          s.lost          = entry["lost"]
          s.goals_for     = entry["goalsFor"]
          s.goals_against = entry["goalsAgainst"]
          s.points        = entry["points"]
          s.save!
        end
      end
    end
  end

  private

  def sync_teams
    raw = @api.teams
    log "Syncing #{raw.length} teams..."
    raw.each do |t|
      Team.find_or_initialize_by(external_id: t["id"]).tap do |team|
        team.name     = t["name"]
        team.code     = (t["tla"] || t["shortName"]&.upcase&.first(3) || "???")
        team.flag_url = t["crest"]
        # derive group from standings if available
        team.save!
      end
    end
  end

  def sync_fixtures
    raw = @api.matches
    log "Syncing #{raw.length} fixtures..."
    raw.each { |m| sync_match(m) }
  end

  def sync_match(m)
    home_team = Team.find_by(external_id: m.dig("homeTeam", "id"))
    away_team = Team.find_by(external_id: m.dig("awayTeam", "id"))
    return unless home_team && away_team

    status = FootballDataClient::STATUS_MAP.fetch(m["status"], "scheduled")
    group  = m["group"]&.gsub("GROUP_", "")
    round  = humanize_round(m["stage"], m["matchday"])

    home_score = m.dig("score", "fullTime", "home")
    away_score = m.dig("score", "fullTime", "away")
    # Fall back to current time score when live
    if status == "live" && home_score.nil?
      home_score = m.dig("score", "halfTime", "home")
      away_score = m.dig("score", "halfTime", "away")
    end

    match = Match.find_or_initialize_by(external_id: m["id"])
    match.assign_attributes(
      home_team:   home_team,
      away_team:   away_team,
      kickoff_at:  m["utcDate"],
      venue:       m.dig("venue") || "TBD",
      round:       round,
      group_stage: group,
      status:      status,
      home_score:  status == "scheduled" ? nil : home_score,
      away_score:  status == "scheduled" ? nil : away_score
    )
    match.save!

    if status == "live"
      ActionCable.server.broadcast("match_#{match.id}", {
        type:       "score_update",
        home_score: match.home_score,
        away_score: match.away_score,
        status:     match.status
      })
    end

    match
  rescue => e
    log "Error syncing match #{m['id']}: #{e.message}"
  end

  def humanize_round(stage, matchday)
    case stage
    when "GROUP_STAGE"    then "Group Stage - MD#{matchday}"
    when "ROUND_OF_16"    then "Round of 16"
    when "QUARTER_FINALS" then "Quarter Final"
    when "SEMI_FINALS"    then "Semi Final"
    when "THIRD_PLACE"    then "3rd Place"
    when "FINAL"          then "Final"
    else stage&.humanize || "?"
    end
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
