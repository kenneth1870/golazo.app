class FixR32GroupStageAndSync < ActiveRecord::Migration[8.1]
  # Root cause: migration 20260701030000 tried to restore 72 group-stage matches
  # by ext_id, but many R32 knockout ext_ids matched and got group_stage stamped
  # on them. Since resync_all_wc_match_dates and resolve_knockout_from_api both
  # use where(group_stage: nil) to find knockout matches, the R32 slots were
  # invisible to all sync jobs — statuses stayed "scheduled", scores nil, events
  # never fetched.
  #
  # Also: pos=8 held England vs Ghana (a group-stage match) instead of the real
  # R32 fixture England vs Congo DR (ext=1567307), and pos=15 had a seeded
  # placeholder (Colombia vs Senegal) instead of Colombia vs Ghana (ext=1567310).

  STATUS_MAP = {
    "FT" => "finished", "AET" => "finished", "PEN" => "finished",
    "NS" => "scheduled", "TBD" => "scheduled", "PST" => "scheduled",
    "1H" => "live", "HT" => "live", "2H" => "live",
    "ET" => "live", "P" => "live", "BT" => "live"
  }.freeze

  def up
    return unless Rails.env.production?

    comp   = Competition.find_by!(code: "WC")
    sync   = WorldCupSync.new(competition_code: "WC")
    client = sync.instance_variable_get(:@api)

    data    = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    r32_api = (data.dig("response") || []).select { |fx| fx.dig("league", "round").to_s =~ /round of 32/i }

    r32_api.each do |fx|
      fid          = fx.dig("fixture", "id").to_s
      home_name    = fx.dig("teams", "home", "name").to_s.strip
      away_name    = fx.dig("teams", "away", "name").to_s.strip
      home         = sync.send(:find_team_by_api_name, home_name)
      away         = sync.send(:find_team_by_api_name, away_name)
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || "scheduled"
      finished     = db_status == "finished"
      kickoff_str  = fx.dig("fixture", "date")

      # Evict this ext_id from any stale holders first
      Match.where(external_id: fid).update_all(external_id: nil)

      # Find the correct slot: by team pair within R32, or fall back to a named slot
      slot = Match.where(competition: comp, round: "Round of 32")
                  .find { |m| m.home_team_id == home&.id && m.away_team_id == away&.id } ||
             find_slot_for(comp, home, fid)

      unless slot
        Rails.logger.warn("[FixR32] No slot found for #{home_name} vs #{away_name} (ext=#{fid})")
        next
      end

      slot.update_columns(
        external_id:    fid,
        group_stage:    nil,
        round:          "Round of 32",
        home_team_id:   home&.id || slot.home_team_id,
        away_team_id:   away&.id || slot.away_team_id,
        status:         db_status,
        home_score:     finished ? fx.dig("goals", "home")           : nil,
        away_score:     finished ? fx.dig("goals", "away")           : nil,
        home_pen_score: fx.dig("score", "penalty", "home"),
        away_pen_score: fx.dig("score", "penalty", "away"),
        kickoff_at:     kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      )

      Rails.logger.info("[FixR32] #{home_name} vs #{away_name} ext=#{fid} pos=#{slot.bracket_pos} status=#{db_status}")

      # Bust per-fixture events cache so finished match goals count immediately
      Rails.cache.delete("wc_fixture_events_v2_#{fid}") if finished
    end

    # Bust aggregate scorer caches
    %w[wc_scorers_v1_WC wc_assists_v1_WC wc_yellow_cards_v1_WC wc_red_cards_v1_WC
       standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }

    Rails.logger.info("[FixR32] Done — #{r32_api.size} R32 fixtures reconciled")
  end

  def down; end

  private

  # For fixtures whose team pair doesn't already exist in a slot, fall back to
  # the named bracket position for the home team's expected slot.
  def find_slot_for(comp, home, fid)
    return nil unless home

    # England vs Congo DR → pos=8 (1L vs T4); replacing England-vs-Ghana placeholder
    # Colombia vs Ghana  → pos=15 (1K vs T8); replacing seeded Colombia-vs-Senegal
    named = {
      "England"  => 8,
      "Colombia" => 15
    }

    pos = named[home.name]
    return nil unless pos

    Match.find_by(competition: comp, bracket_pos: pos)
  end
end
