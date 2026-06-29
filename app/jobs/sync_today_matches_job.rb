class SyncTodayMatchesJob < ApplicationJob
  queue_as :default

  def perform
    wc = Competition.find_by(code: "WC")
    if wc && !Match.where(competition: wc).where(kickoff_at: 12.hours.ago..24.hours.from_now).exists?
      Rails.logger.info("[SyncTodayMatchesJob] No WC matches in 36h window — skipping")
      return
    end
    # Bust the date cache before syncing so fresh scores are always fetched.
    # Past dates are included so stale past matches (still 'scheduled' in DB)
    # are re-fetched from the API rather than served from cache.
    stale_dates = Match.where(status: %w[scheduled live])
                       .where(kickoff_at: 7.days.ago..115.minutes.ago)
                       .pluck(Arel.sql("DATE(kickoff_at AT TIME ZONE 'UTC')"))
                       .uniq
    ([ Date.today, Date.today - 1 ] + stale_dates.map { |d| d.is_a?(Date) ? d : Date.parse(d.to_s) }).uniq.each do |d|
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
    end
    sync = WorldCupSync.new
    sync.sync_today

    # Once per day, force-sync today + tomorrow so any match stored with a
    # wrong kickoff date gets corrected. force: true makes sync_match_from_normalized
    # also update kickoff_at when the API returns a different time.
    cache_key = "sync_today_force_kickoff_v1_#{Date.today.iso8601}"
    unless Rails.cache.exist?(cache_key)
      Rails.cache.write(cache_key, true, expires_in: 23.hours)
      sync.force_sync_dates([ Date.today, Date.today + 1 ])
    end
  end
end
