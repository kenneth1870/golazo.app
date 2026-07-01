class ReorderKnockoutBracketToTournamentTree < ActiveRecord::Migration[8.1]
  # The R32 slots were numbered by kickoff date, but the bracket UI pairs
  # bracket_pos (2k-1, 2k) into R16 slot k. Renumber R32 to the canonical FIFA
  # 2026 tournament tree so the two matches whose winners actually meet sit
  # adjacent. Verified against the two API-published R16 fixtures:
  #   pos 3+4  (South Africa/Canada, Netherlands/Morocco) → Canada vs Morocco
  #   pos 9+10 (Brazil/Japan, Ivory Coast/Norway)         → Brazil vs Norway
  # which fixes the top pair as pos 1+2 (Germany/Paraguay, France/Sweden) →
  # Paraguay vs France.
  #
  # R32 slots are keyed by HOME team (unique per round, and correct in the DB).
  R32_HOME_ORDER = [
    "Germany", "France", "South Africa", "Netherlands",
    "Portugal", "Spain", "United States", "Belgium",
    "Brazil", "Ivory Coast", "Mexico", "England",
    "Argentina", "Australia", "Switzerland", "Colombia"
  ].freeze

  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")

    # ── Round of 32: renumber to the canonical tournament order ─────────────
    R32_HOME_ORDER.each_with_index do |home_name, idx|
      team = Team.find_by(name: home_name)
      next unless team

      slot = Match.find_by(
        competition: competition, round: "Round of 32",
        group_stage: nil, home_team_id: team.id
      )
      unless slot
        Rails.logger.info("[Reorder] R32 home '#{home_name}' not found — skipping")
        next
      end
      slot.update_column(:bracket_pos, idx + 1)
    end

    # ── Round of 16: seat decided winners and align positions to the tree ───
    r16      = Match.where(competition: competition, round: "Round of 16", group_stage: nil).to_a
    france   = Team.find_by(name: "France")
    paraguay = Team.find_by(name: "Paraguay")

    france_slot = r16.find { |m| [ m.home_team_id, m.away_team_id ].include?(france&.id) }
    canada_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Canada") }
    brazil_slot = r16.find { |m| [ m.home_team&.name, m.away_team&.name ].include?("Brazil") }

    # pos 17: Paraguay (winner of pos 1) vs France (winner of pos 2)
    if france_slot
      france_slot.update_columns(
        home_team_id: paraguay&.id || france_slot.home_team_id,
        away_team_id: france&.id,
        bracket_pos:  17
      )
    end
    canada_slot&.update_column(:bracket_pos, 18) # Canada vs Morocco
    brazil_slot&.update_column(:bracket_pos, 21) # Brazil vs Norway

    # Distribute the remaining (still-undecided) R16 slots across the leftover
    # tree positions so no two share a bracket_pos.
    used      = [ france_slot, canada_slot, brazil_slot ].compact.map(&:id)
    leftover  = [ 19, 20, 22, 23, 24 ]
    r16.reject { |m| used.include?(m.id) }.each_with_index do |m, i|
      m.update_column(:bracket_pos, leftover[i]) if leftover[i]
    end

    Rails.cache.delete("standings_WC")
    Rails.logger.info("[Reorder] Knockout bracket reordered to the tournament tree")
  end

  def down; end
end
