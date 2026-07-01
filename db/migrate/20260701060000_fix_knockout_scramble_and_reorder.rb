class FixKnockoutScrambleAndReorder < ActiveRecord::Migration[8.1]
  # The 3h heal job's date-feed restamp scrambled the knockout slots again:
  # scheduled matches ended up with teams that no longer matched their
  # external_id, plus duplicate teams across slots. Each slot's external_id is
  # still a correct, unique pointer to an API fixture, so we rebuild teams FROM
  # the ext_id (dupe-free), then reorder to the tournament tree. The companion
  # code change (Guard 0 in sync_match_from_normalized) stops the restamp from
  # touching knockout slots, so this holds.
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

  # Canonical FIFA 2026 R32 order (by home team), so pos 2k-1 & 2k feed R16 k.
  R32_HOME_ORDER = [
    "Germany", "France", "South Africa", "Netherlands",
    "Portugal", "Spain", "United States", "Belgium",
    "Brazil", "Ivory Coast", "Mexico", "England",
    "Argentina", "Australia", "Switzerland", "Colombia"
  ].freeze

  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")
    sync        = WorldCupSync.new(competition_code: "WC")
    client      = sync.instance_variable_get(:@api)

    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []
    by_id    = fixtures.index_by { |fx| fx.dig("fixture", "id").to_i }
    Rails.logger.info("[FixScramble] #{fixtures.size} fixtures indexed")

    # ── Step 1: rebuild teams from each slot's ext_id (breaks the dupes) ────
    fixed = 0
    Match.where(competition: competition, group_stage: nil)
         .where.not(round: [ nil, "" ])
         .where.not(external_id: nil)
         .find_each do |slot|
      fx = by_id[slot.external_id.to_i]
      next unless fx

      api_round = fx.dig("league", "round").to_s
      next unless KNOCKOUT_ROUNDS.any? { |pat, _| api_round =~ pat } # ext must be a knockout fixture

      home = sync.send(:find_team_by_api_name, fx.dig("teams", "home", "name").to_s.strip)
      away = sync.send(:find_team_by_api_name, fx.dig("teams", "away", "name").to_s.strip)
      next unless home && away

      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || slot.status
      finished     = db_status == "finished"
      kickoff_str  = fx.dig("fixture", "date")

      slot.update_columns(
        home_team_id:   home.id,
        away_team_id:   away.id,
        status:         db_status,
        home_score:     finished ? fx.dig("goals", "home") : nil,
        away_score:     finished ? fx.dig("goals", "away") : nil,
        home_pen_score: fx.dig("score", "penalty", "home"),
        away_pen_score: fx.dig("score", "penalty", "away"),
        kickoff_at:     kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      )
      fixed += 1
    end
    Rails.logger.info("[FixScramble] #{fixed} knockout slot(s) rebuilt from ext_id")

    # ── Step 2: reorder R32 to the canonical tree (home teams unique now) ──
    R32_HOME_ORDER.each_with_index do |home_name, idx|
      team = Team.find_by(name: home_name)
      next unless team

      slot = Match.find_by(
        competition: competition, round: "Round of 32",
        group_stage: nil, home_team_id: team.id
      )
      slot&.update_column(:bracket_pos, idx + 1)
    end

    # ── Step 3: reorder R16 + seat Paraguay vs France ──────────────────────
    r16      = Match.where(competition: competition, round: "Round of 16", group_stage: nil).to_a
    france   = Team.find_by(name: "France")
    paraguay = Team.find_by(name: "Paraguay")

    france_slot = r16.find { |m| [ m.home_team_id, m.away_team_id ].include?(france&.id) }
    canada_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Canada") }
    brazil_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Brazil") }

    if france_slot
      france_slot.update_columns(
        home_team_id: paraguay&.id || france_slot.home_team_id,
        away_team_id: france&.id,
        bracket_pos:  17
      )
    end
    canada_slot&.update_column(:bracket_pos, 18)
    brazil_slot&.update_column(:bracket_pos, 21)

    used     = [ france_slot, canada_slot, brazil_slot ].compact.map(&:id)
    leftover = [ 19, 20, 22, 23, 24 ]
    r16.reject { |m| used.include?(m.id) }.each_with_index do |m, i|
      m.update_column(:bracket_pos, leftover[i]) if leftover[i]
    end

    Rails.cache.delete("standings_WC")
    Rails.cache.delete("standings_WC_best_thirds")
    Rails.logger.info("[FixScramble] Done")
  end

  def down; end
end
