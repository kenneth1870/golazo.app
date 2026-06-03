module Api
  module V1
    class AllLeaguesController < BaseController
      def index
        client = LiveScoresClient.new
        leagues = client.leagues
        render json: leagues
      end

      def live
        client = LiveScoresClient.new
        live = client.live_matches

        # Group by league
        grouped = live.group_by { |m| m["leagueId"] }
        render json: {
          count: live.length,
          matches: live
        }
      end
    end
  end
end
