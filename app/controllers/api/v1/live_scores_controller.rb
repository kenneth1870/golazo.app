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
      def count
        count = Rails.cache.fetch("live_match_count", expires_in: 1.minute) do
          LiveScoresClient.new.live_matches.length
        rescue
          0
        end
        render json: { count: count }
      end
    end
  end
end
