class FixR16DuplicatesAndEnglandR32 < ActiveRecord::Migration[8.1]
  # R32 phase starts June 28. Any "R32" API fixture with a kickoff before this
  # date is a mis-labeled group-stage match — skip it during re-assignment.
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
    sync        = WorldCupSync.new(competition_code: "WC")
    client      = sync.instance_variable_get(:@api)

    # ── Fix 1: Clear R16 slots whose team pair duplicates an R32 pair ───────
    # Germany vs Paraguay already appears in R32 pos=2 (the real match).
    # The same pair in pos=17 R16 is an impossible leftover from pre-seeding.
    r32_pairs = Match.where(competition: competition, round: "Round of 32")
                     .pluck(:home_team_id, :away_team_id)
                     .map { |h, a| [ h, a ].compact.sort }
                     .to_set

    Match.where(competition: competition, round: "Round of 16").each do |slot|
      pair = [ slot.home_team_id, slot.away_team_id ].compact.sort
      next if pair.empty?
      next unless r32_pairs.include?(pair)

      Rails.logger.info("[Fix] Clearing duplicate R16 slot: #{slot.home_team&.name} vs #{slot.away_team&.name}")
      slot.update_columns(
        home_team_id: nil,
        away_team_id: nil,
        home_score:   nil,
        away_score:   nil,
        status:       "scheduled",
        external_id:  nil
      )
    end

    # ── Fix 2: Reset England R32 slot — API returned June 23 GS fixture ────
    england = Team.where("LOWER(name) IN (?)", [ "england" ]).first
    if england
      eng_slot = Match.find_by(competition: competition, round: "Round of 32", home_team: england)
      if eng_slot && eng_slot.kickoff_at&.utc&.to_date&.before?(R32_EARLIEST)
        Rails.logger.info("[Fix] England R32 slot has group-stage kickoff #{eng_slot.kickoff_at} — resetting")
        eng_slot.update_columns(
          away_team_id: nil,
          external_id:  nil,
          home_score:   nil,
          away_score:   nil,
          status:       "scheduled",
          kickoff_at:   Time.utc(2026, 7, 2) # placeholder — real date from API below
        )
      end
    end

    # ── Fix 3: Re-assign from API, skipping mis-labeled group-stage fixtures ─
    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []

    r32 = fixtures.select do |fx|
      round   = fx.dig("league", "round").to_s
      kickoff = fx.dig("fixture", "date").to_s
      ko_date = kickoff.present? ? Date.parse(kickoff) : nil
      (round =~ /round of 32/i) && ko_date && ko_date >= R32_EARLIEST
    end
    Rails.logger.info("[Fix] #{r32.size} valid R32 fixtures from API (kickoff >= #{R32_EARLIEST})")

    r32.each do |fx|
      home_api   = fx.dig("teams", "home", "name").to_s.strip
      away_api   = fx.dig("teams", "away", "name").to_s.strip
      fixture_id = fx.dig("fixture", "id")
      next if home_api.blank? || away_api.blank? || fixture_id.nil?

      home_team = sync.send(:find_team_by_api_name, home_api)
      away_team = sync.send(:find_team_by_api_name, away_api)
      next unless home_team && away_team

      slot = Match.find_by(competition: competition, round: "Round of 32", home_team: home_team)
      next unless slot

      kickoff_str  = fx.dig("fixture", "date")
      kickoff      = kickoff_str.present? ? Time.parse(kickoff_str) : slot.kickoff_at
      status_short = fx.dig("fixture", "status", "short").to_s
      db_status    = STATUS_MAP[status_short] || slot.status
      goals_home   = fx.dig("goals", "home")
      goals_away   = fx.dig("goals", "away")

      if slot.home_team_id == home_team.id
        new_away_id    = away_team.id
        new_home_score = db_status == "finished" ? goals_home : nil
        new_away_score = db_status == "finished" ? goals_away : nil
      elsif slot.home_team_id == away_team.id
        new_away_id    = home_team.id
        new_home_score = db_status == "finished" ? goals_away : nil
        new_away_score = db_status == "finished" ? goals_home : nil
      else
        next
      end

      next if slot.away_team_id == new_away_id && slot.external_id.to_s == fixture_id.to_s

      old_away = slot.away_team&.name || "nil"
      new_away = Team.find_by(id: new_away_id)&.name || new_away_id
      Rails.logger.info("[Fix] #{home_api} vs #{old_away} → #{home_api} vs #{new_away} (ext=#{fixture_id})")

      Match.where(external_id: fixture_id, group_stage: nil)
           .where.not(id: slot.id)
           .update_all(external_id: nil)

      slot.update_columns(
        away_team_id: new_away_id,
        external_id:  fixture_id,
        kickoff_at:   kickoff,
        status:       db_status,
        home_score:   new_home_score,
        away_score:   new_away_score
      )
    end

    # ── Fix 4: Let resolve_knockout fill any newly-cleared R16 TBD slots ───
    sync.resolve_knockout_from_api

    Rails.logger.info("[Fix] Done")
  end

  def down; end
end
