class ReconcileKnockoutPairingsFromApi < ActiveRecord::Migration[8.1]
  # Full authoritative reconciliation of EVERY World Cup match against the API
  # fixture list — the single source of truth. Fixes the knockout drift (wrong
  # away teams at pos 13/15, scrambled ext_ids across pos 13–16, missing R16
  # Morocco) and re-asserts group-stage teams/scores/kickoffs in the same pass.
  #
  # Matching strategy per fixture:
  #   • knockout    → by HOME team (unique within a round; survives ext_id
  #                    scrambling and wrong-opponent drift), then away team,
  #                    then a lingering ext_id, then the first empty slot.
  #   • group stage → by HOME+AWAY pair (fixed per group), then ext_id.
  # group_stage rows are never matched by the knockout branch and vice-versa.
  KNOCKOUT_ROUNDS = {
    /round of 32/i   => "Round of 32",
    /round of 16/i   => "Round of 16",
    /quarter.final/i => "Quarter Final",
    /semi.final/i    => "Semi Final",
    /3rd place/i     => "3rd Place",
    /final/i         => "Final"
  }.freeze

  STATUS_MAP = {
    "FT" => "finished", "AET" => "finished", "PEN" => "finished",
    "NS" => "scheduled", "TBD" => "scheduled",
    "1H" => "live", "HT" => "live", "2H" => "live", "ET" => "live", "P" => "live", "BT" => "live"
  }.freeze

  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")
    sync        = WorldCupSync.new(competition_code: "WC")
    client      = sync.instance_variable_get(:@api)

    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []
    Rails.logger.info("[Reconcile] #{fixtures.size} fixtures from API")

    reconciled = 0
    fixtures.each do |fx|
      home_api = fx.dig("teams", "home", "name").to_s.strip
      away_api = fx.dig("teams", "away", "name").to_s.strip
      fid      = fx.dig("fixture", "id")
      next if home_api.blank? || away_api.blank? || fid.nil?

      home_team = sync.send(:find_team_by_api_name, home_api)
      away_team = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      api_round = fx.dig("league", "round").to_s
      db_round  = KNOCKOUT_ROUNDS.find { |pat, _| api_round =~ pat }&.last

      slot =
        if db_round
          # Knockout: home team is the reliable key (ext_ids drifted / scrambled).
          scope = Match.where(competition: competition, round: db_round, group_stage: nil)
          scope.find_by(home_team_id: home_team.id) ||
            scope.find_by(away_team_id: away_team.id) ||
            scope.find_by(external_id: fid) ||
            scope.where(home_team_id: nil, away_team_id: nil).order(:bracket_pos).first
        else
          # Group stage: the home+away pair is fixed, so match on it directly.
          gscope = Match.where(competition: competition).where.not(group_stage: nil)
          gscope.find_by(home_team_id: home_team.id, away_team_id: away_team.id) ||
            gscope.find_by(external_id: fid)
        end
      next unless slot

      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || slot.status
      finished     = db_status == "finished"
      kickoff_str  = fx.dig("fixture", "date")
      venue        = fx.dig("fixture", "venue", "name")

      # Evict this fixture id from any other slot to avoid the unique-index clash.
      Match.where(external_id: fid).where.not(id: slot.id).update_all(external_id: nil)

      attrs = {
        home_team_id:   home_team.id,
        away_team_id:   away_team.id,
        external_id:    fid,
        status:         db_status,
        home_score:     finished ? fx.dig("goals", "home") : nil,
        away_score:     finished ? fx.dig("goals", "away") : nil,
        home_pen_score: fx.dig("score", "penalty", "home"),
        away_pen_score: fx.dig("score", "penalty", "away")
      }
      attrs[:kickoff_at] = Time.parse(kickoff_str) if kickoff_str.present?
      attrs[:venue]      = venue if venue.present?

      if attrs.any? { |k, v| slot.public_send(k) != v }
        slot.update_columns(attrs)
        Rails.logger.info("[Reconcile] #{db_round || 'Group'} #{home_api} vs #{away_api} "\
                          "(ext=#{fid}, #{db_status})")
        reconciled += 1
      end
    end

    Rails.logger.info("[Reconcile] #{reconciled} match(es) corrected from API")
    Rails.cache.delete("standings_WC")
    Rails.cache.delete("standings_WC_best_thirds")
    Rails.logger.info("[Reconcile] Done")
  end

  def down; end
end
