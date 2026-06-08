class GenerateMatchSummaryJob < ApplicationJob
  queue_as :default

  # Called after a match finishes — pre-warms the AI summary cache
  def perform(match_id:)
    match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                 .find_by(id: match_id)
    return unless match&.status == "finished"

    AiMatchSummaryService.new(match).call
  end
end
