class WorldCupSync
  STATUS_MAP = {
    "NS"  => "scheduled",
    "1H"  => "live",
    "HT"  => "live",
    "2H"  => "live",
    "ET"  => "live",
    "P"   => "live",
    "FT"  => "finished",
    "AET" => "finished",
    "PEN" => "finished",
    "PST" => "scheduled",
    "CANC" => "scheduled",
  }.freeze

  def initialize
    @api = FootballApiClient.new
    @log = Rails.logger
  end

  def sync_all
    log "Starting full World Cup sync..."
    sync_teams
    sync_fixtures
    sync_standings
    log "Sync complete. Teams: #{Team.count}, Matches: #{Match.count}, Standings: #{Standing.count}"
  end

  def sync_fixtures
    fixtures = @api.fixtures
    log "Syncing #{fixtures.length} fixtures..."

    fixtures.each do |f|
      sync_fixture(f)
    rescue => e
      log "Error syncing fixture #{f.dig('fixture', 'id')}: #{e.message}"
    end
  end

  def sync_standings
    data = @api.standings
    groups = data.dig(0, "league", "standings") || []
    log "Syncing standings for #{groups.length} groups..."

    groups.each do |group|
      group.each do |entry|
        team = Team.find_by(external_id: entry.dig("team", "id"))
        next unless team

        Standing.find_or_initialize_by(team: team).tap do |s|
          s.group_name    = entry["group"]&.gsub("Group ", "")
          s.rank          = entry["rank"]
          s.played        = entry.dig("all", "played")
          s.won           = entry.dig("all", "win")
          s.drawn         = entry.dig("all", "draw")
          s.lost          = entry.dig("all", "lose")
          s.goals_for     = entry.dig("all", "goals", "for")
          s.goals_against = entry.dig("all", "goals", "against")
          s.points        = entry["points"]
          s.save!
        end
      end
    end
  end

  def sync_live
    fixtures = @api.live_fixtures
    return if fixtures.empty?
    log "Syncing #{fixtures.length} live fixtures..."
    fixtures.each { |f| sync_fixture(f) }
  end

  def sync_fixture_details(match)
    return unless match.external_id

    events = @api.fixture_events(match.external_id)
    sync_goals(match, events)

    stats = @api.fixture_statistics(match.external_id)
    sync_stats(match, stats)
  end

  private

  def sync_teams
    raw_teams = @api.teams
    log "Syncing #{raw_teams.length} teams..."

    raw_teams.each do |item|
      t = item["team"]
      Team.find_or_initialize_by(external_id: t["id"]).tap do |team|
        team.name     = t["name"]
        team.code     = (t["code"] || t["name"][0, 3]).upcase
        team.flag_url = t["logo"]
        team.save!
      end
    end
  end

  def sync_fixture(f)
    fixture_data = f["fixture"]
    teams_data   = f["teams"]
    goals_data   = f["goals"]
    league_data  = f["league"]

    home_team = Team.find_by(external_id: teams_data.dig("home", "id"))
    away_team = Team.find_by(external_id: teams_data.dig("away", "id"))
    return unless home_team && away_team

    status = STATUS_MAP.fetch(fixture_data.dig("status", "short"), "scheduled")

    match = Match.find_or_initialize_by(external_id: fixture_data["id"])
    match.assign_attributes(
      home_team:   home_team,
      away_team:   away_team,
      kickoff_at:  fixture_data["date"],
      venue:       fixture_data.dig("venue", "name") || "TBD",
      round:       league_data["round"],
      group_stage: extract_group(league_data["round"]),
      status:      status,
      home_score:  status == "scheduled" ? nil : goals_data["home"],
      away_score:  status == "scheduled" ? nil : goals_data["away"]
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
  end

  def sync_goals(match, events)
    return if events.empty?
    match.goals.destroy_all

    events.select { |e| e["type"] == "Goal" }.each do |e|
      team = Team.find_by(external_id: e.dig("team", "id"))
      next unless team

      goal_type = case e["detail"]
                  when "Own Goal" then "own_goal"
                  when "Penalty"  then "penalty"
                  else "regular"
                  end

      match.goals.create!(
        team:        team,
        player_name: e.dig("player", "name") || "Unknown",
        minute:      e["time"]["elapsed"].clamp(1, 120),
        goal_type:   goal_type
      )
    end
  end

  def sync_stats(match, stats)
    return if stats.empty?

    stats.each do |team_stats|
      team = Team.find_by(external_id: team_stats.dig("team", "id"))
      next unless team

      stat = match.match_stats.find_or_initialize_by(team: team)
      values = team_stats["statistics"].each_with_object({}) do |s, h|
        h[s["type"]] = s["value"].to_i
      end

      stat.update!(
        possession:       values["Ball Possession"].to_s.delete("%").to_i,
        shots:            values["Total Shots"],
        shots_on_target:  values["Shots on Goal"],
        corners:          values["Corner Kicks"],
        fouls:            values["Fouls"],
        yellow_cards:     values["Yellow Cards"],
        red_cards:        values["Red Cards"],
        offsides:         values["Offsides"]
      )
    end
  end

  def extract_group(round)
    return nil unless round
    m = round.match(/Group (\w+)/i)
    m ? m[1] : round
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
