class FixBracketPosAndR16Order < ActiveRecord::Migration[8.0]
  # Reference: FIFA 2026 WC bracket draw (P73–P104)
  # bracket_pos = P_number - 72 (so pos 1 = P73, pos 32 = P104)
  #
  # R32 correct assignment (home_code, away_code → pos):
  #   RSA/CAN=1  GER/PAR=2  NED/MAR=3  BRA/JPN=4
  #   FRA/SWE=5  CIV/NOR=6  MEX/ECU=7  ENG/COD=8
  #   USA/BIH=9  BEL/SEN=10 POR/CRO=11 ESP/AUT=12
  #   SUI/ALG=13 ARG/CPV=14 COL/GHA=15 AUS/EGY=16
  #
  # R16 swaps (production currently has PAR/FRA at pos 21 and BRA/NOR at pos 22):
  #   pos 17 ↔ pos 21  (PAR/FRA game belongs at 17; W11/W12 placeholder at 21)
  #   pos 19 ↔ pos 22  (BRA/NOR game belongs at 19; W9/W10 placeholder at 22)

  R32_CORRECT = [
    %w[RSA CAN],  %w[GER PAR],  %w[NED MAR],  %w[BRA JPN],
    %w[FRA SWE],  %w[CIV NOR],  %w[MEX ECU],  %w[ENG COD],
    %w[USA BIH],  %w[BEL SEN],  %w[POR CRO],  %w[ESP AUT],
    %w[SUI ALG],  %w[ARG CPV],  %w[COL GHA],  %w[AUS EGY]
  ].each_with_index.map { |(h, a), i| { home: h, away: a, pos: i + 1 } }

  def up
    wc = Competition.find_by!(code: "WC")

    # ── Fix R32 bracket_pos ──────────────────────────────────────────────────
    R32_CORRECT.each do |entry|
      home_id = Team.find_by(code: entry[:home])&.id
      away_id = Team.find_by(code: entry[:away])&.id
      next unless home_id && away_id

      m = wc.matches.where(round: "Round of 32")
             .where("(home_team_id = ? AND away_team_id = ?) OR (home_team_id = ? AND away_team_id = ?)",
                    home_id, away_id, away_id, home_id)
             .first
      next unless m

      next if m.bracket_pos == entry[:pos]
      say "R32: #{entry[:home]}/#{entry[:away]} pos #{m.bracket_pos} → #{entry[:pos]}"
      m.update_columns(bracket_pos: entry[:pos])
    end

    # ── Fix R16 bracket_pos + slot refs ─────────────────────────────────────
    #
    # Swap 1: PAR/FRA (currently pos 21) ↔ W11/W12 placeholder (currently pos 17)
    #   PAR/FRA (the real P89 game) should live at pos 17
    #   The TBD placeholder should live at pos 21 with slots W11/W12
    par_fra = wc.matches.where(round: "Round of 16", bracket_pos: 21).first
    w11_w12 = wc.matches.where(round: "Round of 16", bracket_pos: 17).first

    if par_fra && w11_w12 && par_fra.bracket_pos != 17
      say "R16: moving PAR/FRA from pos 21 → 17"
      say "R16: moving W2/W5 placeholder from pos 17 → 21 (slots → W11/W12)"
      par_fra.update_columns(bracket_pos: 17)
      w11_w12.update_columns(bracket_pos: 21, home_slot: "W11", away_slot: "W12")
    end

    # Swap 2: BRA/NOR (currently pos 22) ↔ W9/W10 placeholder (currently pos 19)
    #   BRA/NOR (the real P91 game) should live at pos 19
    #   The TBD placeholder should live at pos 22 with slots W9/W10
    bra_nor = wc.matches.where(round: "Round of 16", bracket_pos: 22).first
    w9_w10  = wc.matches.where(round: "Round of 16", bracket_pos: 19).first

    if bra_nor && w9_w10 && bra_nor.bracket_pos != 19
      say "R16: moving BRA/NOR from pos 22 → 19"
      say "R16: moving W4/W6 placeholder from pos 19 → 22 (slots → W9/W10)"
      bra_nor.update_columns(bracket_pos: 19)
      w9_w10.update_columns(bracket_pos: 22, home_slot: "W9", away_slot: "W10")
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
