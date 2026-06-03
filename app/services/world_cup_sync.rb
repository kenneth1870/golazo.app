class WorldCupSync
  def initialize(competition_code: "WC")
    @api  = FootballDataClient.new
    @code = competition_code
    @log  = Rails.logger
  end

  # Full sync for one competition
  def sync_all
    log "Full sync: #{@code}"
    competition = sync_competition
    sync_teams(competition)
    sync_fixtures(competition)
    sync_standings(competition)
    log "Done — Teams: #{Team.count}, Matches: #{Match.count}, Standings: #{Standing.count}"
  end

  # Sync all competitions available on the account, then today's matches
  def sync_today
    matches = @api.today_matches
    log "Today: #{matches.length} matches across #{matches.map { |m| m.dig('competition','code') }.uniq.length} competitions"
    matches.each { |m| sync_match_row(m) }
  end

  # Sync only currently live matches
  def sync_live
    matches = @api.live_matches
    return log("No live matches") if matches.empty?
    log "Live: #{matches.length} matches"
    matches.each { |m| sync_match_row(m) }
  end

  def sync_standings(competition = nil)
    competition ||= Competition.find_by!(code: @code)
    groups = @api.standings(@code)
    log "Standings: #{groups.length} groups"

    groups.each do |group|
      group_label = group["group"]&.gsub("GROUP_", "") || "?"
      (group["table"] || []).each do |entry|
        team = Team.find_by(external_id: entry.dig("team", "id"))
        next unless team

        Standing.find_or_initialize_by(team: team, competition: competition).tap do |s|
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

  def sync_competition
    raw = @api.competitions.find { |c| c["code"] == @code }

    unless raw
      raw = { "id" => nil, "name" => @code, "code" => @code, "type" => "CUP",
              "emblem" => nil, "area" => {} }
    end

    Competition.find_or_initialize_by(code: @code).tap do |c|
      c.name             = raw["name"]
      c.logo             = raw["emblem"]
      c.country          = raw.dig("area", "name")
      c.competition_type = raw["type"]
      c.external_id      = raw["id"]
      c.save!
    end
  end

  def sync_teams(competition)
    raw = @api.teams(@code)
    log "Teams: #{raw.length}"
    raw.each do |t|
      Team.find_or_initialize_by(external_id: t["id"]).tap do |team|
        team.name     = t["name"]
        team.code     = (t["tla"] || t["shortName"]&.upcase&.first(3) || "???")
        team.flag_url = t["crest"]
        team.save!
      end
    end
  end

  def sync_fixtures(competition)
    raw = @api.matches(@code)
    log "Fixtures: #{raw.length}"
    raw.each { |m| sync_match_row(m, competition) }
  end

  def sync_match_row(m, competition = nil)
    # Resolve competition from DB or inline competition data
    comp_code = m.dig("competition", "code") || @code
    competition ||= Competition.find_or_create_by!(code: comp_code) do |c|
      c.name             = m.dig("competition", "name") || comp_code
      c.logo             = m.dig("competition", "emblem")
      c.competition_type = m.dig("competition", "type") || "LEAGUE"
      c.external_id      = m.dig("competition", "id")
    end

    home_team = find_or_create_team(m["homeTeam"])
    away_team = find_or_create_team(m["awayTeam"])
    return unless home_team && away_team

    status     = FootballDataClient::STATUS_MAP.fetch(m["status"], "scheduled")
    group      = m["group"]&.gsub("GROUP_", "")
    round      = humanize_round(m["stage"], m["matchday"])
    home_score = m.dig("score", "fullTime", "home")
    away_score = m.dig("score", "fullTime", "away")

    if status == "live" && home_score.nil?
      home_score = m.dig("score", "halfTime", "home")
      away_score = m.dig("score", "halfTime", "away")
    end

    match = Match.find_or_initialize_by(external_id: m["id"])
    match.assign_attributes(
      competition: competition,
      home_team:   home_team,
      away_team:   away_team,
      kickoff_at:  m["utcDate"],
      venue:       m["venue"] || competition.name,
      round:       round,
      group_stage: group,
      status:      status,
      home_score:  status == "scheduled" ? nil : home_score,
      away_score:  status == "scheduled" ? nil : away_score
    )
    match.save!

    if status == "live"
      ActionCable.server.broadcast("match_#{match.id}", {
        type: "score_update", home_score: match.home_score,
        away_score: match.away_score, status: match.status
      })
    end

    match
  rescue => e
    log "Error on match #{m['id']}: #{e.message}"
  end

  def find_or_create_team(data)
    return nil if data.nil? || data["id"].nil?
    Team.find_or_initialize_by(external_id: data["id"]).tap do |t|
      t.name     ||= data["name"] || data["shortName"] || "Unknown"
      t.code     ||= (data["tla"] || data["shortName"]&.upcase&.first(3) || "???")
      t.flag_url ||= data["crest"]
      t.save! if t.new_record? || t.changed?
    end
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
