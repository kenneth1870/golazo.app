class ResolveKnockoutSlotsJob < ApplicationJob
  queue_as :default

  def perform
    return if AppFocus.wc_paused?

    resolved = WorldCupSync.new.resolve_knockout_from_api
    Rails.logger.info("[ResolveKnockoutSlotsJob] #{resolved} slot(s) resolved")
  end
end
