class ResyncAllWcMatchesJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("[ResyncAllWcMatchesJob] Starting full WC data heal")
    sync  = WorldCupSync.new(competition_code: "WC")
    fixed = sync.resync_all_wc_match_dates
    RecalculateStandingsJob.perform_now
    Rails.logger.info("[ResyncAllWcMatchesJob] Done — #{fixed} match(es) corrected")
  end
end
