class ClearPartialR16GhostTeams < ActiveRecord::Migration[8.1]
  # Migration 20260701120000 cleared R16 slots where home_team_id was set but
  # external_id was nil. It missed slots where only the AWAY team was set
  # (home_team_id nil). The wrong propagation left France as away_team in pos 17
  # (from R16_PAIRINGS[0] = W2 vs W5, W5=France) while pos 21 correctly holds
  # the real API fixture Paraguay vs France (ext=1569870). This creates a
  # duplicate France visible in the bracket.
  #
  # Fix: clear any non-finished R16 slot with no external_id that has EITHER
  # home_team OR away_team set from old propagation.

  def up
    comp = Competition.find_by(code: "WC")
    return unless comp

    # Collect teams already in a real API-matched R16 fixture so we can identify
    # which non-API teams are propagation ghosts.
    confirmed_r16_team_ids = comp.matches
                                 .where(round: "Round of 16")
                                 .where.not(external_id: nil)
                                 .pluck(:home_team_id, :away_team_id)
                                 .flatten.compact.to_set

    ghosts = comp.matches
                 .where(round: "Round of 16", external_id: nil)
                 .where.not(status: "finished")
                 .select { |m|
                   (m.home_team_id && confirmed_r16_team_ids.include?(m.home_team_id)) ||
                   (m.away_team_id && confirmed_r16_team_ids.include?(m.away_team_id))
                 }

    ghosts.each do |m|
      Rails.logger.info("[ClearR16Ghost] clearing pos=#{m.bracket_pos} " \
                        "#{m.home_team&.name || 'nil'} vs #{m.away_team&.name || 'nil'}")
      m.update_columns(home_team_id: nil, away_team_id: nil)
    end

    Rails.logger.info("[ClearR16Ghost] done — #{ghosts.size} partial R16 ghost slot(s) cleared")

    %w[standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }
  end

  def down; end
end
