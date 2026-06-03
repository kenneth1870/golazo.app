class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  def perform
    LiveScoresSync.new.sync
  end
end
