class RestoreGroupStageMatches < ActiveRecord::Migration[8.1]
  STATUS_MAP = {
    "FT"  => "finished",
    "AET" => "finished",
    "PEN" => "finished",
    "NS"  => "scheduled",
    "TBD" => "scheduled",
    "1H"  => "live",
    "HT"  => "live",
    "2H"  => "live",
    "ET"  => "live",
    "P"   => "live"
  }.freeze

  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")
    sync        = WorldCupSync.new(competition_code: "WC")
    client      = sync.instance_variable_get(:@api)

    Rails.logger.info("[RestoreGroupStage] Fetching all WC fixtures from API")
    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []
    Rails.logger.info("[RestoreGroupStage] #{fixtures.size} fixtures from API")

    # Only group stage fixtures (Matchday / Group round naming, before R32)
    gs_fixtures = fixtures.select do |fx|
      round = fx.dig("league", "round").to_s
      round =~ /matchday|group\s+stage/i
    end
    Rails.logger.info("[RestoreGroupStage] #{gs_fixtures.size} group-stage fixtures identified")

    restored = 0
    gs_fixtures.each do |fx|
      home_api   = fx.dig("teams", "home", "name").to_s.strip
      away_api   = fx.dig("teams", "away", "name").to_s.strip
      fixture_id = fx.dig("fixture", "id")
      next if home_api.blank? || away_api.blank? || fixture_id.nil?

      home_team = sync.send(:find_team_by_api_name, home_api)
      away_team = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      # Find by team pair — teams are still assigned, only ext_id/scores/kickoff were wiped
      slot = Match.find_by(
        competition:  competition,
        home_team_id: home_team.id,
        away_team_id: away_team.id
      )
      unless slot
        Rails.logger.info("[RestoreGroupStage] No DB slot for #{home_api} vs #{away_api}")
        next
      end

      kickoff_str  = fx.dig("fixture", "date")
      kickoff      = kickoff_str.present? ? Time.parse(kickoff_str) : nil
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || "finished"
      goals_home   = fx.dig("goals", "home")
      goals_away   = fx.dig("goals", "away")
      pen_home     = fx.dig("score", "penalty", "home")
      pen_away     = fx.dig("score", "penalty", "away")

      updates = {
        external_id: fixture_id,
        status:      db_status
      }
      updates[:kickoff_at]      = kickoff if kickoff
      updates[:home_score]      = goals_home if db_status == "finished"
      updates[:away_score]      = goals_away if db_status == "finished"
      updates[:home_pen_score]  = pen_home   if pen_home
      updates[:away_pen_score]  = pen_away   if pen_away

      slot.update_columns(updates)
      restored += 1
    end

    Rails.logger.info("[RestoreGroupStage] Restored #{restored} group-stage matches")
    Rails.logger.info("[RestoreGroupStage] Done")
  end

  def down; end
end
