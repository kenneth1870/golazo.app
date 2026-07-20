class ResyncAllWcMatchesJob < ApplicationJob
  queue_as :default

  def perform
    return if AppFocus.wc_paused?

    Rails.logger.info("[ResyncAllWcMatchesJob] Starting full WC data heal")
    sync    = WorldCupSync.new(competition_code: "WC")
    fixed   = sync.resync_all_wc_match_dates
    resolved = sync.resolve_knockout_from_api
    RecalculateStandingsJob.perform_now
    Rails.logger.info("[ResyncAllWcMatchesJob] Done — #{fixed} match(es) corrected, #{resolved} knockout slot(s) resolved")
  end
end
