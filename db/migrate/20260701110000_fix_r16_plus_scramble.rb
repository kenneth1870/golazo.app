class FixR16PlusScramble < ActiveRecord::Migration[8.1]
  # Production R32/R16 data is corrupted in several ways:
  #
  #   1. France vs Sweden appears in BOTH pos 2 and pos 5 (duplicate team pair).
  #   2. Several external_ids are duplicated across two rows, bypassing the
  #      unique constraint (written via earlier migrations using update_columns):
  #        ext=1567824  on R32 pos 5  AND R16 pos 18
  #        ext=1565178  on R32 pos 14 AND R32 pos 16
  #        ext=1567312  on R32 pos 13 AND R32 pos 15
  #   3. R16 slots were populated by resolve_knockout_from_api using "first empty
  #      slot" heuristics, landing teams and ext_ids in wrong positions:
  #        pos 17: France vs France   (should be TBD vs France)
  #        pos 18: Canada vs Morocco  (should be Paraguay vs Canada = W1 vs W3)
  #        pos 21: Paraguay vs France (should be W11 vs W12)
  #        pos 22: Brazil vs Norway   (should be Brazil vs W10)
  #   4. R32 pos 8 (England vs Ghana) is marked finished 0-0 with no pen scores,
  #      which is invalid for a knockout match.
  #
  # Fix strategy:
  #   A. De-duplicate R32 team pairs (keep highest bracket_pos, clear others).
  #   B. Strip duplicate external_ids: for any ext_id on >1 row, keep it only
  #      on the R32 row (or the finished row); nil it out elsewhere.
  #   C. Fix R32 pos 8 (invalid 0-0 no-pens finished state).
  #   D. Reset ALL non-finished R16+ slots (teams + ext_id) so propagation can
  #      run cleanly — rows with ext_id are skipped by propagate_later_rounds.
  #   E. Run WorldCupKnockout.rebuild! with the now-correct R32 state.

  def up
    return unless Rails.env.production?

    comp = Competition.find_by!(code: "WC")

    # ── A. De-duplicate R32 team pairs ──────────────────────────────────────
    # If two R32 slots have the same (home_team_id, away_team_id), the higher
    # bracket_pos is the authoritative one (lower pos was filled first by the
    # "first empty slot" bug in resolve_knockout_from_api).
    r32_rows = comp.matches.where(round: "Round of 32", group_stage: nil).to_a
    seen_pairs = {}
    r32_rows.sort_by { |m| -m.bracket_pos }.each do |m|
      next unless m.home_team_id && m.away_team_id
      key = [ m.home_team_id, m.away_team_id ]
      if seen_pairs[key]
        Rails.logger.info("[FixR16] A: clearing dup R32 pos=#{m.bracket_pos} #{m.home_team&.name} vs #{m.away_team&.name}")
        m.update_columns(home_team_id: nil, away_team_id: nil, external_id: nil,
                         status: "scheduled", home_score: nil, away_score: nil,
                         home_pen_score: nil, away_pen_score: nil)
      else
        seen_pairs[key] = m
      end
    end

    # ── B. Strip duplicate external_ids ─────────────────────────────────────
    # Find every external_id that appears on more than one match.  Prefer the
    # R32 row; among equals prefer finished; otherwise prefer higher bracket_pos.
    dup_ext_ids = comp.matches
                      .where(group_stage: nil)
                      .where.not(external_id: nil)
                      .group(:external_id)
                      .having("count(*) > 1")
                      .pluck(:external_id)

    dup_ext_ids.each do |eid|
      holders = comp.matches.where(external_id: eid, group_stage: nil)
                            .order(:bracket_pos).to_a
      # Pick winner: prefer R32 finished row, else finished, else first by pos
      keeper = holders.find { |m| m.round == "Round of 32" && m.status == "finished" } ||
               holders.find { |m| m.status == "finished" } ||
               holders.first
      losers = holders.reject { |m| m.id == keeper.id }
      losers.each do |m|
        Rails.logger.info("[FixR16] B: stripping dup ext=#{eid} from pos=#{m.bracket_pos} #{m.round}")
        m.update_columns(external_id: nil)
      end
    end

    # ── C. Fix R32 pos 8 invalid 0-0 finished state ─────────────────────────
    # England vs Ghana is marked finished 0-0 with no penalty scores.
    # A knockout match cannot end 0-0 without penalties.  Reset to scheduled
    # so the next sync can pull the correct result from the API.
    pos8 = comp.matches.find_by(round: "Round of 32", bracket_pos: 8, group_stage: nil)
    if pos8 && pos8.status == "finished" && pos8.home_score == 0 && pos8.away_score == 0 &&
       pos8.home_pen_score.nil? && pos8.away_pen_score.nil?
      Rails.logger.info("[FixR16] C: resetting invalid 0-0 R32 pos 8 (#{pos8.home_team&.name} vs #{pos8.away_team&.name})")
      pos8.update_columns(status: "scheduled", home_score: nil, away_score: nil)
    end

    # ── D. Reset all non-finished R16+ slots ────────────────────────────────
    # Clear teams AND external_id.  Without this, propagate_later_rounds skips
    # any row that has external_id set, leaving wrong teams frozen in place.
    reset_count = comp.matches
                      .where(round: %w[Round\ of\ 16 Quarter\ Final Semi\ Final 3rd\ Place Final],
                             group_stage: nil)
                      .where.not(status: "finished")
                      .update_all(home_team_id: nil, away_team_id: nil, external_id: nil)
    Rails.logger.info("[FixR16] D: reset #{reset_count} non-finished R16+ slot(s)")

    # ── E. Rebuild from clean R32 state ─────────────────────────────────────
    WorldCupKnockout.rebuild!
    Rails.logger.info("[FixR16] E: rebuild complete")

    # Bust caches
    %w[standings_WC standings_WC_best_thirds].each { |k| Rails.cache.delete(k) }
  end

  def down; end
end
