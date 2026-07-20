module Api
  module V1
    class LiveScoresController < BaseController
      include ApiMatchNormalizer

      # Live matches — already normalized by LiveScoresClient#live_matches
      def index
        matches = LiveScoresClient.new.live_matches
        matches = filter_matches_for_focus(matches)
        render json: matches
      rescue StandardError => e
        Rails.logger.error("[LiveScoresController] #{e.message}")
        render json: []
      end

      # Lightweight endpoint — just the live count for the nav badge.
      # Read from the same cache key as #index so the count and the list are
      # always derived from identical data and we never hit the API twice.
      def count
        matches = Rails.cache.read("live_scores_live_v6") || LiveScoresClient.new.live_matches
        count = filter_matches_for_focus(matches).size
        render json: { count: count }
      rescue StandardError => e
        Rails.logger.error("[LiveScoresController#count] #{e.message}")
        render json: { count: 0 }
      end
    end
  end
end
