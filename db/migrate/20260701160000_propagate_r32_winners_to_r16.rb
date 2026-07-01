class PropagateR32WinnersToR16 < ActiveRecord::Migration[8.0]
  # For every finished R32 match, find the R16 slot whose home_slot or away_slot
  # references that bracket_pos (stored as "W{pos}") and stamp in the winning team.
  # Safe to re-run: only fills NULL team slots, never overwrites an already-set team.
  def up
    wc = Competition.find_by!(code: "WC")

    finished = Match.where(competition: wc, round: "Round of 32", status: "finished")
                    .includes(:home_team, :away_team)

    finished.each do |m|
      next unless m.home_team && m.away_team

      winner = winning_team(m)
      next unless winner

      slot_ref = "W#{m.bracket_pos}"
      r16_matches = Match.where(competition: wc, round: "Round of 16")
                         .where("home_slot = ? OR away_slot = ?", slot_ref, slot_ref)

      r16_matches.each do |r16|
        if r16.home_slot == slot_ref && r16.home_team_id.nil?
          say "R16 pos #{r16.bracket_pos}: home → #{winner.name} (#{slot_ref})"
          r16.update_column(:home_team_id, winner.id)
        elsif r16.away_slot == slot_ref && r16.away_team_id.nil?
          say "R16 pos #{r16.bracket_pos}: away → #{winner.name} (#{slot_ref})"
          r16.update_column(:away_team_id, winner.id)
        end
      end
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def winning_team(match)
    hs = match.home_score.to_i
    as = match.away_score.to_i
    hp = match.home_pen_score
    ap = match.away_pen_score

    if hp.present? && ap.present?
      hp.to_i > ap.to_i ? match.home_team : match.away_team
    elsif hs != as
      hs > as ? match.home_team : match.away_team
    end
  end
end
