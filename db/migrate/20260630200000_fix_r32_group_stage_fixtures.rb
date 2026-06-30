class FixR32GroupStageFixtures < ActiveRecord::Migration[8.1]
  # These external_ids belong to GROUP STAGE matches that got mis-linked into
  # Round of 32 knockout slots. The dates (June 12-23) are clearly group stage.
  #
  #   pos=2  Germany   vs Curacao   ext=1489374  June 14  (GS)
  #   pos=8  England   vs Ghana     ext=1489402  June 23  (GS)
  #   pos=9  USA       vs Paraguay  ext=1489370  June 12  (GS)
  #   pos=16 Australia vs Turkey    ext=1539001  June 14  (GS)
  GROUP_STAGE_EXT_IDS = [ 1_489_374, 1_489_402, 1_489_370, 1_539_001 ].freeze

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

    # ── Step 1: Reset the 4 bad R32 slots ──────────────────────────────────
    # Clear away_team, external_id, scores, status. Home_team stays so we can
    # re-match by home_team when we loop through real R32 fixtures below.
    bad_slots = Match.where(external_id: GROUP_STAGE_EXT_IDS, group_stage: nil)
    Rails.logger.info("[FixR32] Found #{bad_slots.count} bad knockout slots to reset")
    bad_slots.each do |slot|
      Rails.logger.info("  Resetting: #{slot.home_team&.name} vs #{slot.away_team&.name} (ext=#{slot.external_id})")
      slot.update_columns(
        external_id:  nil,
        away_team_id: nil,
        home_score:   nil,
        away_score:   nil,
        status:       "scheduled",
        kickoff_at:   Time.utc(2026, 7, 1), # placeholder in R32 window
      )
    end

    # ── Step 2: Pull full WC fixture list from API-Football ─────────────────
    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []
    Rails.logger.info("[FixR32] Pulled #{fixtures.size} total fixtures from API")

    r32 = fixtures.select { |fx| fx.dig("league", "round").to_s =~ /round of 32/i }
    Rails.logger.info("[FixR32] #{r32.size} Round of 32 fixtures from API")

    # Build a lookup: team_id → [slot] for all R32 slots (home or away)
    # so we can match regardless of whether the API lists the team as home/away.
    r32_slots_by_team = {}
    Match.where(competition: competition, round: "Round of 32").each do |slot|
      [ slot.home_team_id, slot.away_team_id ].compact.each do |tid|
        r32_slots_by_team[tid] ||= []
        r32_slots_by_team[tid] << slot
      end
    end

    # ── Step 3: Re-assign R32 slots from API data ───────────────────────────
    r32.each do |fx|
      home_api   = fx.dig("teams", "home", "name").to_s.strip
      away_api   = fx.dig("teams", "away", "name").to_s.strip
      fixture_id = fx.dig("fixture", "id")
      next if home_api.blank? || away_api.blank? || fixture_id.nil?

      home_team = sync.send(:find_team_by_api_name, home_api)
      away_team = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      # Find the R32 DB slot for the home team (by home_team_id first, then away_team_id)
      slot = Match.find_by(competition: competition, round: "Round of 32", home_team: home_team)

      # Fallback: API might list bracket-home as away — find by either side
      unless slot
        candidates = (r32_slots_by_team[home_team.id] || []) + (r32_slots_by_team[away_team.id] || [])
        # Find a slot that has one of these teams but NOT the other (meaning away_team is wrong/nil)
        slot = candidates.find { |s| s.external_id.to_i != fixture_id.to_i }
      end

      next unless slot

      kickoff_str  = fx.dig("fixture", "date")
      kickoff      = kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || slot.status
      goals_home   = fx.dig("goals", "home")
      goals_away   = fx.dig("goals", "away")

      # Determine the correct home/away orientation for the DB slot
      if slot.home_team_id == home_team.id
        # Normal: DB home matches API home
        new_away_id    = away_team.id
        new_home_score = db_status == "finished" ? goals_home : nil
        new_away_score = db_status == "finished" ? goals_away : nil
      elsif slot.home_team_id == away_team.id
        # Reversed: DB home is the API away
        new_away_id    = home_team.id
        new_home_score = db_status == "finished" ? goals_away : nil
        new_away_score = db_status == "finished" ? goals_home : nil
      else
        Rails.logger.info("[FixR32] No orientation match for slot #{slot.id}: #{home_api} vs #{away_api}")
        next
      end

      current_away_id = slot.away_team_id
      current_ext_id  = slot.external_id.to_s

      if current_away_id != new_away_id || current_ext_id != fixture_id.to_s
        old_away = slot.away_team&.name || "nil"
        new_away = Team.find(new_away_id).name rescue new_away_id
        Rails.logger.info("[FixR32] #{slot.home_team.name} vs #{old_away} → #{slot.home_team.name} vs #{new_away} (ext=#{fixture_id})")

        # Evict any other knockout slot that holds this external_id
        Match.where(external_id: fixture_id, group_stage: nil)
             .where.not(id: slot.id)
             .update_all(external_id: nil)

        slot.update_columns(
          away_team_id: new_away_id,
          external_id:  fixture_id,
          kickoff_at:   kickoff,
          status:       db_status,
          home_score:   new_home_score,
          away_score:   new_away_score,
        )
      end
    end

    Rails.logger.info("[FixR32] Done")
  end

  def down; end
end
