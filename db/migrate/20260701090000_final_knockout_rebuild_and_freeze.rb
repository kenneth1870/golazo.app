class FinalKnockoutRebuildAndFreeze < ActiveRecord::Migration[8.1]
  # Definitive knockout rebuild, run after the heal-job writers were made safe
  # (Guard 0 blocks the date-feed restamp; resolve_knockout_from_api is now
  # fill-empty / exact-match only). With no automated job able to rewrite
  # established pairings, the correct state set here stays frozen.
  #
  #   1. Bijectively bind the 16 API R32 fixtures to slots (ext → home → orphan)
  #   2. Delete any leftover orphan R32 slot (NULL ext duplicate)
  #   3. Fix R16 Canada/Morocco & Brazil/Norway by ext; seat Paraguay vs France
  #   4. Renumber R32/R16 bracket_pos to the canonical tournament tree
  STATUS_MAP = {
    "FT" => "finished", "AET" => "finished", "PEN" => "finished",
    "NS" => "scheduled", "TBD" => "scheduled", "PST" => "scheduled",
    "1H" => "live", "HT" => "live", "2H" => "live", "ET" => "live", "P" => "live", "BT" => "live"
  }.freeze

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
    r32_fx   = fixtures.select { |fx| fx.dig("league", "round").to_s =~ /round of 32/i }

    slots    = Match.where(competition: competition, round: "Round of 32", group_stage: nil).to_a
    used_ids = []
    pos_for  = {}
    R32_HOME_ORDER.each_with_index { |name, i| pos_for[name] = i + 1 }

    # ── 1: bind + write each R32 fixture ───────────────────────────────────
    bindings = r32_fx.map do |fx|
      home = sync.send(:find_team_by_api_name, fx.dig("teams", "home", "name").to_s.strip)
      away = sync.send(:find_team_by_api_name, fx.dig("teams", "away", "name").to_s.strip)
      next nil unless home && away

      fid  = fx.dig("fixture", "id")
      slot = slots.find { |s| !used_ids.include?(s.id) && s.external_id.to_s == fid.to_s } ||
             slots.find { |s| !used_ids.include?(s.id) && s.home_team_id == home.id } ||
             slots.find { |s| !used_ids.include?(s.id) && s.away_team_id == away.id }
      used_ids << slot.id if slot
      [ fx, slot, home, away ]
    end.compact

    leftovers = slots.reject { |s| used_ids.include?(s.id) }
    bindings.each do |b|
      next if b[1]
      b[1] = leftovers.shift
      used_ids << b[1].id if b[1]
    end

    bindings.each do |fx, slot, home, away|
      next unless slot

      fid          = fx.dig("fixture", "id")
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || "scheduled"
      finished     = db_status == "finished"
      kickoff_str  = fx.dig("fixture", "date")

      Match.where(external_id: fid).where.not(id: slot.id).update_all(external_id: nil)
      slot.update_columns(
        home_team_id:   home.id,
        away_team_id:   away.id,
        external_id:    fid,
        status:         db_status,
        home_score:     finished ? fx.dig("goals", "home") : nil,
        away_score:     finished ? fx.dig("goals", "away") : nil,
        home_pen_score: fx.dig("score", "penalty", "home"),
        away_pen_score: fx.dig("score", "penalty", "away"),
        kickoff_at:     kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at,
        bracket_pos:    pos_for[home.name] || slot.bracket_pos
      )
    end

    # ── 2: delete leftover orphan R32 slots (NULL ext duplicates) ──────────
    Match.where(competition: competition, round: "Round of 32", group_stage: nil)
         .where(external_id: nil).where(status: %w[scheduled])
         .where(home_score: nil, away_score: nil)
         .find_each do |m|
      Rails.logger.info("[Final] Deleting orphan R32 id=#{m.id} #{m.home_team&.name} vs #{m.away_team&.name}")
      m.destroy
    end

    # ── 3: R16 fix by ext + seat Paraguay vs France ────────────────────────
    r16      = Match.where(competition: competition, round: "Round of 16", group_stage: nil).to_a
    france   = Team.find_by(name: "France")
    paraguay = Team.find_by(name: "Paraguay")

    fixtures.select { |fx| fx.dig("league", "round").to_s.strip == "Round of 16" }.each do |fx|
      home = sync.send(:find_team_by_api_name, fx.dig("teams", "home", "name").to_s.strip)
      away = sync.send(:find_team_by_api_name, fx.dig("teams", "away", "name").to_s.strip)
      fid  = fx.dig("fixture", "id")
      next unless home && away

      slot = r16.find { |m| m.external_id.to_s == fid.to_s } ||
             r16.find { |m| m.home_team_id == home.id } ||
             r16.find { |m| m.away_team_id == away.id }
      next unless slot

      Match.where(external_id: fid).where.not(id: slot.id).update_all(external_id: nil)
      slot.update_columns(home_team_id: home.id, away_team_id: away.id, external_id: fid)
    end

    france_slot = r16.find { |m| [ m.home_team_id, m.away_team_id ].include?(france&.id) }
    canada_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Canada") }
    brazil_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Brazil") }

    france_slot&.update_columns(
      home_team_id: paraguay&.id || france_slot.home_team_id,
      away_team_id: france&.id, bracket_pos: 17
    )
    canada_slot&.update_column(:bracket_pos, 18)
    brazil_slot&.update_column(:bracket_pos, 21)

    used     = [ france_slot, canada_slot, brazil_slot ].compact.map(&:id)
    leftover = [ 19, 20, 22, 23, 24 ]
    r16.reject { |m| used.include?(m.id) }.each_with_index do |m, i|
      m.update_column(:bracket_pos, leftover[i]) if leftover[i]
    end

    Rails.cache.delete("standings_WC")
    Rails.cache.delete("standings_WC_best_thirds")
    Rails.logger.info("[Final] Knockout rebuild complete and frozen")
  end

  def down; end
end
