class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  def perform
    sync = WorldCupSync.new(competition_code: "WC")
    sync.sync_today
    sync.recalculate_standings_from_results
    WorldCupKnockout.rebuild!
    Rails.cache.delete("standings_WC")
    Rails.cache.write("standings_last_recalculated_at", Time.current.iso8601, expires_in: 2.days)
  end
end
