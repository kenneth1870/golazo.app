class SyncTodayMatchesJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new.sync_today
  end
end
