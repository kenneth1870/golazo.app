class DeleteOrphanR32Slot < ActiveRecord::Migration[8.1]
  # Repeated corruption left a 17th Round of 32 slot — a duplicate with a NULL
  # external_id whose pairing already lives on a proper ext-bearing slot. Every
  # real R32 fixture has an external_id, so an R32 slot without one is spurious.
  # Delete only provably-duplicate orphans (NULL ext, not finished, no scores,
  # pairing present elsewhere) so the bracket has exactly 16 R32 matches.
  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")
    r32 = Match.where(competition: competition, round: "Round of 32", group_stage: nil).to_a

    paired_with_ext = r32.select(&:external_id)
                         .map { |m| [ m.home_team_id, m.away_team_id ] }.to_set

    orphans = r32.select do |m|
      m.external_id.nil? &&
        m.status != "finished" &&
        m.home_score.nil? && m.away_score.nil? &&
        paired_with_ext.include?([ m.home_team_id, m.away_team_id ])
    end

    orphans.each do |m|
      Rails.logger.info("[DeleteOrphan] Removing R32 id=#{m.id} pos=#{m.bracket_pos} "\
                        "#{m.home_team&.name} vs #{m.away_team&.name} (NULL ext, duplicate)")
      m.destroy
    end

    remaining = Match.where(competition: competition, round: "Round of 32", group_stage: nil).count
    Rails.logger.info("[DeleteOrphan] Deleted #{orphans.size} orphan(s); #{remaining} R32 slots remain")

    Rails.cache.delete("standings_WC")
    Rails.cache.delete("standings_WC_best_thirds")
  end

  def down; end
end
