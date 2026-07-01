class FixR32GroupStageRestamp < ActiveRecord::Migration[8.1]
  # R32 phase began June 28. Any knockout slot whose kickoff is before
  # this date, or whose ext_id belongs to a group-stage fixture, is corrupted.
  R32_EARLIEST = Time.utc(2026, 6, 28)

  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")
    sync   = WorldCupSync.new(competition_code: "WC")
    client = sync.instance_variable_get(:@api)

    # ── Fix 1: reset slots stamped with group-stage data ─────────────────
    # A background job restamped knockout slots with old group-stage fixtures
    # (pre-June-28 kickoffs, or ext_ids already belonging to group-stage
    # matches). This shows up as pos=8 England finished June 23 and pos=7
    # Mexico vs Sweden (Sweden already has a pos=5 R32 match).
    # Only knockout matches — group_stage must be nil AND round must be a knockout term.
    # Using `group_stage: nil` prevents us from touching group-stage matches whose
    # round field is "Matchday 1", "Matchday 2", etc. (they also have a non-blank round).
    corrupted = Match
      .where(competition: competition)
      .where(group_stage: nil)
      .where.not(round: [ nil, "" ])
      .where(
        "kickoff_at < ? OR external_id IN (?)",
        R32_EARLIEST,
        Match.where(competition: competition).where.not(group_stage: nil).select(:external_id)
      )

    corrupted.find_each do |slot|
      Rails.logger.info("[Fix] Resetting #{slot.round} pos=#{slot.bracket_pos} "\
                        "(#{slot.home_team&.name} vs #{slot.away_team&.name}, "\
                        "kickoff=#{slot.kickoff_at&.to_date}, ext=#{slot.external_id})")
      slot.update_columns(
        external_id: nil,
        home_score:  nil,
        away_score:  nil,
        status:      "scheduled",
        kickoff_at:  Time.utc(2026, 7, 1)  # placeholder until re-resolved
      )
    end

    # ── Fix 2: clear away_team if it already finished a match in this round ─
    Match.where(competition: competition).where.not(round: [ nil, "" ]).find_each do |slot|
      next if slot.status == "finished"

      %i[home_team_id away_team_id].each do |col|
        team_id = slot.public_send(col)
        next unless team_id

        conflict = Match.where(competition: competition, round: slot.round, status: "finished")
                         .where.not(id: slot.id)
                         .where("home_team_id = ? OR away_team_id = ?", team_id, team_id)
                         .exists?
        next unless conflict

        name = Team.find_by(id: team_id)&.name
        Rails.logger.info("[Fix] Clearing #{name} from #{slot.round} pos=#{slot.bracket_pos} — already finished this round elsewhere")
        slot.update_columns(col => nil, external_id: nil, home_score: nil, away_score: nil, status: "scheduled")
        slot.reload
      end
    end

    # ── Fix 3: re-pull from API and restore correct pairings ─────────────
    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []

    r32_fixtures = fixtures.select do |fx|
      round   = fx.dig("league", "round").to_s
      kickoff = fx.dig("fixture", "date").to_s
      ko_date = kickoff.present? ? Time.parse(kickoff).utc : nil
      (round =~ /round of 32/i) && ko_date && ko_date >= R32_EARLIEST
    end
    Rails.logger.info("[Fix] #{r32_fixtures.size} valid R32 fixtures from API")

    # Collect teams already used in a finished R32 match (cannot appear elsewhere)
    finished_r32_team_ids = Match.where(competition: competition, round: "Round of 32", status: "finished")
                                  .pluck(:home_team_id, :away_team_id).flatten.compact.to_set

    r32_fixtures.each do |fx|
      home_api   = fx.dig("teams", "home", "name").to_s.strip
      away_api   = fx.dig("teams", "away", "name").to_s.strip
      fixture_id = fx.dig("fixture", "id")
      next if home_api.blank? || away_api.blank? || fixture_id.nil?

      home_team = sync.send(:find_team_by_api_name, home_api)
      away_team = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      # Skip if either team already finished R32 elsewhere (conflict guard)
      if finished_r32_team_ids.include?(home_team.id) || finished_r32_team_ids.include?(away_team.id)
        Rails.logger.info("[Fix] Skipping #{home_api} vs #{away_api} — a team already finished R32")
        next
      end

      # Skip if this ext_id already belongs to a group-stage match
      if Match.where(external_id: fixture_id).where.not(group_stage: nil).exists?
        Rails.logger.info("[Fix] Skipping ext=#{fixture_id} — group-stage fixture")
        next
      end

      slot = Match.find_by(competition: competition, round: "Round of 32", home_team: home_team)
      next unless slot
      next if slot.away_team_id == away_team.id && slot.external_id.to_s == fixture_id.to_s

      kickoff_str  = fx.dig("fixture", "date")
      kickoff      = kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = { "FT" => "finished", "AET" => "finished", "PEN" => "finished", "NS" => "scheduled", "TBD" => "scheduled" }[status_short] || slot.status
      goals_home   = fx.dig("goals", "home")
      goals_away   = fx.dig("goals", "away")

      Match.where(external_id: fixture_id, group_stage: nil).where.not(id: slot.id).update_all(external_id: nil)

      slot.update_columns(
        away_team_id: away_team.id,
        external_id:  fixture_id,
        kickoff_at:   kickoff,
        status:       db_status,
        home_score:   db_status == "finished" ? goals_home : nil,
        away_score:   db_status == "finished" ? goals_away : nil
      )
      Rails.logger.info("[Fix] Resolved pos=#{slot.bracket_pos}: #{home_api} vs #{away_api} (ext=#{fixture_id})")
    end

    Rails.logger.info("[Fix] Done")
  end

  def down; end
end
