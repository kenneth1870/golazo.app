class ResyncAllWcMatchScores < ActiveRecord::Migration[8.1]
  def up
    ResyncAllWcMatchesJob.perform_later
  end

  def down
    # one-time trigger, nothing to undo
  end
end
