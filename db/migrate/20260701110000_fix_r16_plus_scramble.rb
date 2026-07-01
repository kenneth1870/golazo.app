class FixR16PlusScramble < ActiveRecord::Migration[8.1]
  # R16 and later rounds were populated by resolve_knockout_from_api using
  # "first empty slot" heuristics, landing teams in the wrong positions.
  # This migration:
  #   1. Removes duplicate team assignments in R32 (France appeared twice).
  #   2. Resets all R16/QF/SF/Final/3rd-Place slots to blank so they can be
  #      re-derived cleanly from the actual R32 results via WorldCupKnockout.rebuild!
  #   3. Runs rebuild! to re-propagate winners correctly.

  R16_AND_UP = %w[Round of 16 Quarter Final Semi Final 3rd Place Final].freeze

  def up
    return unless Rails.env.production?

    comp = Competition.find_by!(code: "WC")

    # --- 1. De-duplicate R32: if the same (home_team_id, away_team_id) pair
    # appears in more than one slot, keep only the highest bracket_pos one
    # (lowest positions were filled first by the "first empty slot" bug).
    r32 = comp.matches.where(round: "Round of 32", group_stage: nil).to_a
    seen = {}
    r32.sort_by { |m| -m.bracket_pos }.each do |m|
      next unless m.home_team_id && m.away_team_id
      key = [ m.home_team_id, m.away_team_id ]
      if seen[key]
        Rails.logger.info("[FixR16] Clearing duplicate R32 pos=#{m.bracket_pos} #{m.home_team&.name} vs #{m.away_team&.name} ext=#{m.external_id}")
        m.update_columns(home_team_id: nil, away_team_id: nil, external_id: nil, status: "scheduled",
                         home_score: nil, away_score: nil, home_pen_score: nil, away_pen_score: nil)
      else
        seen[key] = m
      end
    end

    # --- 2. Reset all R16 and later slots so rebuild! can repopulate them
    # cleanly. Clear teams AND external_id so neither propagate_later_rounds
    # (which skips ext_id-present rows) nor stale API assignments interfere.
    comp.matches
        .where(round: R16_AND_UP, group_stage: nil)
        .where.not(status: "finished")
        .update_all(home_team_id: nil, away_team_id: nil, external_id: nil)

    Rails.logger.info("[FixR16] Reset R16+ non-finished slots")

    # --- 3. Rebuild from R32 results (applies penalty-aware winner propagation).
    WorldCupKnockout.rebuild!
    Rails.logger.info("[FixR16] Rebuild complete")

    # Bust caches
    %w[standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }
  end

  def down; end
end
