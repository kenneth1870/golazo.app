module Api
  module V1
    class AllLeaguesController < BaseController
      include ApiMatchNormalizer

      def index
        render json: client.leagues
      rescue StandardError => e
        Rails.logger.error("[AllLeaguesController#index] #{e.message}")
        render json: [], status: :service_unavailable
      end

      def live
        live = filter_matches_for_focus(client.live_matches)
        render json: { count: live.length, matches: live.first(50) }
      rescue StandardError => e
        Rails.logger.error("[AllLeaguesController#live] #{e.message}")
        render json: { count: 0, matches: [] }, status: :service_unavailable
      end

      private

      def client
        @client ||= LiveScoresClient.new
      end
    end
  end
end
