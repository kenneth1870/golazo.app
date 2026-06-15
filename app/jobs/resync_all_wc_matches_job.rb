class ResyncAllWcMatchesJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("[ResyncAllWcMatchesJob] Starting full historical WC match re-sync")
    sync = WorldCupSync.new(competition_code: "WC")
    sync.resync_all_wc_match_dates
    RecalculateStandingsJob.perform_now
    Rails.logger.info("[ResyncAllWcMatchesJob] Done")
  end
end
