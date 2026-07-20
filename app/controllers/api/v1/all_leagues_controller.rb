module Api
  module V1
    class AllLeaguesController < BaseController
      include ApiMatchNormalizer

      def index
        render json: client.leagues
      end

      def live
        live = filter_matches_for_focus(client.live_matches)
        render json: { count: live.length, matches: live.first(50) }
      end

      private

      def client
        @client ||= LiveScoresClient.new
      end
    end
  end
end
