class HealKnockoutGroupStageMistags < ActiveRecord::Migration[8.1]
  def up
    competition = Competition.find_by(code: "WC")
    return unless competition

    mistagged = Match.where(competition: competition)
                      .where.not(round: [ nil, "" ])
                      .where.not(group_stage: nil)
    count = mistagged.count
    return if count.zero?

    mistagged.find_each { |m| m.update_columns(group_stage: nil) }
    Rails.logger.info("[HealKnockoutGroupStage] Cleared group_stage on #{count} knockout match(es)")
  end

  def down; end
end
