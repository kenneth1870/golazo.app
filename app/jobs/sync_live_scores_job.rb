class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new.sync_live unless AppFocus.wc_paused?
    ClubLiveSync.new.sync_live if AppFocus.clubs_primary?
  end
end
