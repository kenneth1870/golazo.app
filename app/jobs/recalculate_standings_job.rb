class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new(competition_code: "WC").recalculate_standings_from_results
  end
end
