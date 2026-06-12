module Api
  module V1
    class LiveScoresController < BaseController
      # Live matches — already normalized by LiveScoresClient#live_matches
      def index
        render json: LiveScoresClient.new.live_matches
      rescue => e
        Rails.logger.error("[LiveScoresController] #{e.message}")
        render json: []
      end

      # Lightweight endpoint — just the live count for the nav badge.
      # Read from the same cache key as #index so the count and the list are
      # always derived from identical data and we never hit the API twice.
      def count
        matches = Rails.cache.read("live_scores_live_v6") || LiveScoresClient.new.live_matches
        wc_count = matches.count { |m| m[:league_id].to_i == 1 }
        render json: { count: wc_count }
      rescue => e
        Rails.logger.error("[LiveScoresController#count] #{e.message}")
        render json: { count: 0 }
      end
    end
  end
end
