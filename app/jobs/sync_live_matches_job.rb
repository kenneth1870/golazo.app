class SyncLiveMatchesJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new.sync_live
  end
end
