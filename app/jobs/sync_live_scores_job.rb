class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  # Single source of truth for live score updates. Pulls currently-live matches
  # from the API and updates matching DB fixtures (with team-name aliasing),
  # broadcasting score changes over Action Cable.
  def perform
    WorldCupSync.new.sync_live
  end
end
