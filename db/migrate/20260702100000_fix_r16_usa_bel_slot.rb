class FixR16UsaBelSlot < ActiveRecord::Migration[8.0]
  # Production state: USA vs BEL ended up in pos 21 (P93) instead of pos 22 (P94).
  # BEL also appears as away_team on pos 22 as a duplicate.
  #
  # Correct state:
  #   pos 21 (P93): empty — waiting for POR/CRO winner vs ESP/AUT winner
  #   pos 22 (P94): USA vs BEL (winner of P81 × winner of P82)
  def up
    wc = Competition.find_by!(code: "WC")

    pos21 = wc.matches.find_by!(round: "Round of 16", bracket_pos: 21)
    pos22 = wc.matches.find_by!(round: "Round of 16", bracket_pos: 22)

    usa = Team.find_by(code: "USA")
    bel = Team.find_by(code: "BEL")

    has_usa_bel_in_21 = [ pos21.home_team_id, pos21.away_team_id ].sort ==
                        [ usa&.id, bel&.id ].sort

    unless has_usa_bel_in_21
      say "pos 21 does not have USA/BEL — skipping (already fixed)"
      return
    end

    say "Moving USA vs BEL from pos 21 → pos 22"

    # Snapshot pos 21 data before clearing it
    transfer = {
      home_team_id:   pos21.home_team_id,
      away_team_id:   pos21.away_team_id,
      external_id:    pos21.external_id,
      kickoff_at:     pos21.kickoff_at,
      venue:          pos21.venue,
      status:         pos21.status,
      home_score:     pos21.home_score,
      away_score:     pos21.away_score,
      home_pen_score: pos21.home_pen_score,
      away_pen_score: pos21.away_pen_score
    }

    # Clear pos 21 of ext_id first (unique index)
    pos21.update_columns(external_id: nil)

    # Write USA/BEL data to pos 22
    pos22.update_columns(transfer.merge(home_slot: "W9", away_slot: "W10"))
    say "  pos 22: USA vs BEL (home_slot=W9 away_slot=W10)"

    # Reset pos 21 to empty placeholder
    pos21.update_columns(
      home_team_id:   nil,
      away_team_id:   nil,
      status:         "scheduled",
      home_score:     nil,
      away_score:     nil,
      home_pen_score: nil,
      away_pen_score: nil,
      home_slot:      "W11",
      away_slot:      "W12"
    )
    say "  pos 21: cleared, home_slot=W11 away_slot=W12"
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
