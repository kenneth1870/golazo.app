class ClearWrongR16Propagation < ActiveRecord::Migration[8.1]
  # The previous migration (20260701110000) called WorldCupKnockout.rebuild!
  # which ran propagate_later_rounds using our R16_PAIRINGS constant. Those
  # pairings do not match the actual 2026 FIFA WC cross-bracket format, so
  # R16 slots ended up with teams from wrong matchups. The real R16 pairings
  # come from the API (resolve_knockout_from_api), which assigned real fixtures:
  #   pos 18: Canada vs Morocco   (ext=1567824)
  #   pos 21: Paraguay vs France  (ext=1569870)
  #   pos 22: Brazil vs Norway    (ext=1568100)
  # The wrong propagation additionally put:
  #   pos 17: Canada vs France    (no ext — wrong)
  #   pos 19: Morocco vs Norway   (no ext — wrong)
  # This migration clears the wrongly-propagated slots so that only the
  # API-confirmed fixtures remain. The code has also been updated to skip R16
  # in propagate_later_rounds so this cannot recur.

  def up
    return unless Rails.env.production?

    comp = Competition.find_by!(code: "WC")

    # Clear all non-finished R16 slots that have teams but NO ext_id.
    # These were set by our wrong propagation, not by the API.
    wrong = comp.matches
                .where(round: "Round of 16", group_stage: nil)
                .where.not(status: "finished")
                .where(external_id: nil)
                .where.not(home_team_id: nil)

    wrong.each do |m|
      Rails.logger.info("[ClearR16] clearing wrong propagation at pos=#{m.bracket_pos} " \
                        "#{m.home_team&.name} vs #{m.away_team&.name}")
      m.update_columns(home_team_id: nil, away_team_id: nil)
    end

    Rails.logger.info("[ClearR16] done — #{wrong.size} wrongly-propagated R16 slot(s) cleared")

    %w[standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }
  end

  def down; end
end
