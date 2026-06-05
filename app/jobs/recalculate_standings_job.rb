class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  def perform
    WorldCupSync.new(competition_code: "WC").recalculate_standings_from_results
    # Standings changed → refresh which teams fill the knockout bracket.
    WorldCupKnockout.rebuild!
    Rails.cache.delete("standings_WC")
  end
end
