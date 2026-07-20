class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  # Single source of truth for live score updates. Pulls currently-live matches
  # from the API and updates matching DB fixtures (with team-name aliasing),
  # broadcasting score changes over Action Cable and firing push notifications.
  #
  # Runs every minute via the recurring schedule. The former +30 s follow-up job
  # was removed to halve API-Football quota usage; goal/fulltime detection latency
  # is now max ~60 s, which is acceptable for push notifications.
  def perform
    return if AppFocus.wc_paused?

    WorldCupSync.new.sync_live
  end
end
