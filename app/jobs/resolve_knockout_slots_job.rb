class ResolveKnockoutSlotsJob < ApplicationJob
  queue_as :default

  def perform
    resolved = WorldCupSync.new.resolve_knockout_from_api
    Rails.logger.info("[ResolveKnockoutSlotsJob] #{resolved} slot(s) resolved")
  end
end
