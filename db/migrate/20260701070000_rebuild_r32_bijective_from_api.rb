class RebuildR32BijectiveFromApi < ActiveRecord::Migration[8.1]
  # Repeated corruption left an orphan R32 slot (stale teams, NULL external_id)
  # and an unassigned API fixture (USA vs Bosnia), so ext_id-keyed repair could
  # not reach it. Do a bijective rebuild: map each of the 16 API R32 fixtures to
  # exactly one DB slot (by ext_id → home team → leftover orphan), so every
  # fixture is placed and every orphan is repurposed. Then set canonical
  # bracket_pos. The live Guard 0 keeps the heal job from re-scrambling this.
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
    Rails.logger.info("[Rebuild] #{r32_fx.size} API R32 fixtures")

    slots     = Match.where(competition: competition, round: "Round of 32", group_stage: nil).to_a
    used_ids  = []

    # ── Pass 1: bind each fixture to a slot (ext_id → home team → orphan) ──
    bindings = [] # [fixture, slot, home_team, away_team]
    r32_fx.each do |fx|
      fid  = fx.dig("fixture", "id")
      home = sync.send(:find_team_by_api_name, fx.dig("teams", "home", "name").to_s.strip)
      away = sync.send(:find_team_by_api_name, fx.dig("teams", "away", "name").to_s.strip)
      next unless home && away

      slot = slots.find { |s| !used_ids.include?(s.id) && s.external_id.to_s == fid.to_s } ||
             slots.find { |s| !used_ids.include?(s.id) && s.home_team_id == home.id } ||
             slots.find { |s| !used_ids.include?(s.id) && s.away_team_id == away.id }
      bindings << [ fx, slot, home, away ]
      used_ids << slot.id if slot
    end

    # Assign any fixture still without a slot to a leftover (orphan) slot.
    leftovers = slots.reject { |s| used_ids.include?(s.id) }
    bindings.each do |b|
      next if b[1]
      b[1] = leftovers.shift
      used_ids << b[1].id if b[1]
    end

    # ── Pass 2: write each binding (teams, ext, scores, pos) ──────────────
    pos_for = {}
    R32_HOME_ORDER.each_with_index { |name, i| pos_for[name] = i + 1 }

    bindings.each do |fx, slot, home, away|
      next unless slot

      fid          = fx.dig("fixture", "id")
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || "scheduled"
      finished     = db_status == "finished"
      kickoff_str  = fx.dig("fixture", "date")

      # Evict this ext_id from any other row first (unique index).
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
      Rails.logger.info("[Rebuild] pos=#{pos_for[home.name]} #{home.name} vs #{away.name} (ext=#{fid})")
    end

    # ── R16: fix Canada/Morocco & Brazil/Norway by ext, seat Paraguay/France ──
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
    Rails.logger.info("[Rebuild] Done")
  end

  def down; end
end
