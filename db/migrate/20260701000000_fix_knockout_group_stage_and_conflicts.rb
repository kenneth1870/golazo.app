class FixKnockoutGroupStageAndConflicts < ActiveRecord::Migration[8.1]
  R32_EARLIEST = Date.new(2026, 6, 28)

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

    # ── Fix 1: clear bogus group_stage on knockout matches ─────────────────
    # A self-heal in WorldCupSync stamped a team's original group letter onto
    # finished R32 matches whenever group_stage was nil. The bracket page
    # filters on `!group_stage` to find knockout matches, so this made
    # Netherlands vs Morocco, Ivory Coast vs Norway, France vs Sweden, and
    # Mexico vs Ecuador silently vanish from the bracket.
    mistagged = Match.where(competition: competition)
                      .where.not(round: [ nil, "" ])
                      .where.not(group_stage: nil)
    Rails.logger.info("[Fix] Clearing bogus group_stage on #{mistagged.count} knockout match(es)")
    mistagged.find_each { |m| m.update_columns(group_stage: nil) }

    # ── Fix 2: clear teams that conflict with their own finished match ─────
    # A team that already finished a match in a round can't legitimately
    # appear in a second match in the same round. Clear the corrupted side
    # so it can be re-resolved below from the authoritative API fixture.
    Match.where(competition: competition).where.not(round: [ nil, "" ]).find_each do |slot|
      next if slot.status == "finished"

      [ %i[home_team_id home_score], %i[away_team_id away_score] ].each do |team_col, score_col|
        team_id = slot.public_send(team_col)
        next unless team_id

        conflict = Match.where(competition: competition, round: slot.round, status: "finished")
                         .where.not(id: slot.id)
                         .where("home_team_id = ? OR away_team_id = ?", team_id, team_id)
                         .exists?
        next unless conflict

        team_name = Team.find_by(id: team_id)&.name
        Rails.logger.info("[Fix] Clearing #{team_name} from #{slot.round} slot pos=#{slot.bracket_pos} — already finished this round elsewhere")
        slot.update_columns(team_col => nil, score_col => nil, status: "scheduled", external_id: nil)
        slot.reload
      end
    end

    # ── Fix 3: re-resolve any slot left with a missing team from the API ───
    sync   = WorldCupSync.new(competition_code: "WC")
    client = sync.instance_variable_get(:@api)
    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []

    incomplete = Match.where(competition: competition, round: "Round of 32")
                       .where("home_team_id IS NULL OR away_team_id IS NULL")
    incomplete.each do |slot|
      next unless slot.home_team_id || slot.away_team_id

      known_team = slot.home_team || slot.away_team
      candidate = fixtures.find do |fx|
        round   = fx.dig("league", "round").to_s
        kickoff = fx.dig("fixture", "date").to_s
        ko_date = kickoff.present? ? Date.parse(kickoff) : nil
        next false unless (round =~ /round of 32/i) && ko_date && ko_date >= R32_EARLIEST

        home_api = fx.dig("teams", "home", "name").to_s.strip
        away_api = fx.dig("teams", "away", "name").to_s.strip
        [ home_api, away_api ].any? { |n| sync.send(:find_team_by_api_name, n) == known_team }
      end
      next unless candidate

      home_api   = candidate.dig("teams", "home", "name").to_s.strip
      away_api   = candidate.dig("teams", "away", "name").to_s.strip
      fixture_id = candidate.dig("fixture", "id")
      home_team  = sync.send(:find_team_by_api_name, home_api)
      away_team  = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      other_team = (home_team == known_team) ? away_team : home_team
      conflict = Match.where(competition: competition, round: "Round of 32", status: "finished")
                       .where("home_team_id = ? OR away_team_id = ?", other_team.id, other_team.id)
                       .exists?
      if conflict
        Rails.logger.info("[Fix] Skipping #{home_api} vs #{away_api} for pos=#{slot.bracket_pos} — #{other_team.name} already finished R32 elsewhere")
        next
      end

      kickoff_str  = candidate.dig("fixture", "date")
      kickoff      = kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      status_short = candidate.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || slot.status
      goals_home   = candidate.dig("goals", "home")
      goals_away   = candidate.dig("goals", "away")

      Match.where(external_id: fixture_id, group_stage: nil).where.not(id: slot.id).update_all(external_id: nil)

      slot.update_columns(
        home_team_id: home_team.id,
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
