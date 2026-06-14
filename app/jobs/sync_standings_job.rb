class SyncStandingsJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new(competition_code: "WC").sync_standings
    Rails.cache.delete("standings_WC")
  end
end
