class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  # Debounce: if another job fires within 10 seconds, skip — the earlier one
  # will handle it. Prevents stampedes when multiple WC matches finish at once.
  discard_on(ActiveJob::DeserializationError)

  def perform
    lock_key = "recalculate_standings_running"
    return if Rails.cache.read(lock_key)

    Rails.cache.write(lock_key, true, expires_in: 30.seconds)
    sync = WorldCupSync.new(competition_code: "WC")
    sync.sync_today
    sync.recalculate_standings_from_results
    WorldCupKnockout.rebuild!
    Rails.cache.delete("standings_WC")
    Rails.cache.write("standings_last_recalculated_at", Time.current.iso8601, expires_in: 2.days)
  ensure
    Rails.cache.delete(lock_key)
  end
end
