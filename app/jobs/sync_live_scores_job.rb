class SyncLiveScoresJob < ApplicationJob
  queue_as :default

  # Single source of truth for live score updates. Pulls currently-live matches
  # from the API and updates matching DB fixtures (with team-name aliasing),
  # broadcasting score changes over Action Cable and firing push notifications.
  #
  # The recurring schedule fires this every minute (the finest cron granularity).
  # To cut goal/full-time latency to ~30 s without burning quota, each *recurring*
  # run enqueues ONE follow-up at +30 s — but only while a WC match is actually
  # being played (status "live"), not during the broad pre-/post-match window.
  # Follow-ups don't chain, so there are at most 2 runs per minute, and only for
  # the ~2 h a match is live. Outside live play this is the plain 1-min recurring
  # job (and it self-gates to skip the API call entirely when nothing's active).
  def perform(followup: false)
    WorldCupSync.new.sync_live

    return if followup
    return unless WorldCupSync.live_now?

    self.class.set(wait: 30.seconds).perform_later(followup: true)
  end
end
