class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  # Single source of truth for live score updates. Pulls currently-live matches
  # from the API and updates matching DB fixtures (with team-name aliasing),
  # broadcasting score changes over Action Cable and firing push notifications.
  #
  # The recurring schedule fires this every minute (the finest cron granularity).
  # To cut goal/full-time notification latency to ~20 s, each *recurring* run also
  # enqueues two follow-up runs at +20 s and +40 s while WC matches are live or
  # imminent — giving ~20 s effective polling during live windows only. Follow-ups
  # do not chain further, so there are at most 3 runs per minute (bounded, no
  # pile-up), and none of this runs during the ~23 h/day with no active matches.
  def perform(followup: false)
    WorldCupSync.new.sync_live

    return if followup
    return unless WorldCupSync.live_window_active?

    self.class.set(wait: 20.seconds).perform_later(followup: true)
    self.class.set(wait: 40.seconds).perform_later(followup: true)
  end
end
