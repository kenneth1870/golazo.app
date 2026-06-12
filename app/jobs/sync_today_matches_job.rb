class SyncTodayMatchesJob < ApplicationJob
  queue_as :default

  def perform
    wc = Competition.find_by(code: "WC")
    if wc && !Match.where(competition: wc).where(kickoff_at: 12.hours.ago..24.hours.from_now).exists?
      Rails.logger.info("[SyncTodayMatchesJob] No WC matches in 36h window — skipping")
      return
    end
    WorldCupSync.new.sync_today
  end
end
