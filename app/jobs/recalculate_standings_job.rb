class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  def perform
    sync = WorldCupSync.new(competition_code: "WC")
    # Sync today's results first (including early next-day UTC matches) so the
    # DB has up-to-date finished matches before standings are computed.
    sync.sync_today
    sync.recalculate_standings_from_results
    # Standings changed → refresh which teams fill the knockout bracket.
    WorldCupKnockout.rebuild!
    Rails.cache.delete("standings_WC")
  end
end
