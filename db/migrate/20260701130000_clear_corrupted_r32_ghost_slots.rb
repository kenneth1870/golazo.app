class ClearCorruptedR32GhostSlots < ActiveRecord::Migration[8.1]
  # R32 slots that have no external_id but contain teams already placed in
  # another R32 slot (which has a real external_id) are ghost rows — leftover
  # from old "first empty slot" heuristics in resolve_knockout_from_api before
  # the correct fixtures were loaded.
  #
  # Strategy: find every team_id that appears in an API-confirmed R32 slot
  # (external_id present). Any R32 slot with NO external_id that contains one
  # of those teams is a ghost and must be cleared. Once empty, the next run of
  # resolve_knockout_from_api will assign the correct API fixture to the slot.
  #
  # Production examples that this fixes:
  #   pos 2:  Germany vs DR Congo   (null ext) — Germany already in pos 1
  #   pos 10: Ivory Coast vs Norway (null ext) — both teams already in pos 6
  #   pos 13: Switzerland vs Paraguay (null ext) — Paraguay already in pos 1
  #
  # Local-dev example:
  #   pos 15: Colombia vs Senegal   (null ext) — Senegal already in pos 9

  def up
    comp = Competition.find_by(code: "WC")
    return unless comp

    confirmed_team_ids = comp.matches
                             .where(round: "Round of 32")
                             .where.not(external_id: nil)
                             .pluck(:home_team_id, :away_team_id)
                             .flatten
                             .compact
                             .uniq

    ghosts = comp.matches
                 .where(round: "Round of 32", external_id: nil)
                 .where.not(home_team_id: nil)
                 .select { |m| confirmed_team_ids.include?(m.home_team_id) ||
                               confirmed_team_ids.include?(m.away_team_id) }

    ghosts.each do |m|
      Rails.logger.info("[ClearR32Ghost] clearing pos=#{m.bracket_pos} " \
                        "#{m.home_team&.name} vs #{m.away_team&.name} (status=#{m.status})")
      m.update_columns(
        home_team_id:   nil,
        away_team_id:   nil,
        status:         "scheduled",
        home_score:     nil,
        away_score:     nil,
        home_pen_score: nil,
        away_pen_score: nil
      )
    end

    Rails.logger.info("[ClearR32Ghost] done — #{ghosts.size} ghost slot(s) cleared; " \
                      "resolve_knockout_from_api will assign the correct API fixtures")

    # Do NOT call WorldCupKnockout.rebuild! here: resolve_round_of_32 uses our
    # R32_SLOTS definitions which are mis-ordered for this tournament (e.g. it
    # would wrongly put Germany in two slots). Leaving these slots fully empty
    # lets resolve_knockout_from_api use its "first empty slot" fallback to
    # correctly assign the real API fixtures.

    %w[standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }
  end

  def down; end
end
