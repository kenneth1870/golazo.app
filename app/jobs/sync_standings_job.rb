class SyncStandingsJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new(competition_code: "WC").sync_standings
  end
end
