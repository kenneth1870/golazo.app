class ResyncAllWcMatchScores < ActiveRecord::Migration[8.1]
  # One-time score backfill, intentionally neutralized.
  #
  # This previously called ResyncAllWcMatchesJob.perform_later, but enqueuing a
  # job from a migration is racy: on deploy, migrations run in the release phase
  # BEFORE new workers start, so the job was picked up by the still-running OLD
  # worker (which didn't have the class yet) -> ActiveJob::UnknownJobClassError.
  #
  # The backfill it was meant to do is already handled by the normal sync paths
  # (sync_stale_past_matches re-syncs recently-finished matches from the date
  # endpoint), so no enqueue is needed here. Run it manually if a one-off
  # historical re-sync is ever required:
  #   bin/rails runner "ResyncAllWcMatchesJob.perform_now"
  def up
    # no-op (see comment above)
  end

  def down
    # nothing to undo
  end
end
