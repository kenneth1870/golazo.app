class SyncTodayMatchesJob < ApplicationJob
  queue_as :default

  def perform
    wc = Competition.find_by(code: "WC")
    if wc && !Match.where(competition: wc).where(kickoff_at: 12.hours.ago..24.hours.from_now).exists?
      Rails.logger.info("[SyncTodayMatchesJob] No WC matches in 36h window — skipping")
      return
    end
    # Bust the date cache before syncing so fresh scores are always fetched.
    # The inner cache has a 24h TTL for past dates; without busting it,
    # matches that finished after the cache was first populated would stay
    # 'scheduled' until the cache naturally expires.
    [ Date.today, Date.today - 1 ].each do |d|
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
    end
    WorldCupSync.new.sync_today
  end
end
