module Api
  module V1
    class FixtureOddsController < BaseController
      # GET /api/v1/fixture_odds/:fixture_id
      def show
        data = LiveScoresClient.new.fixture_odds(params[:fixture_id])
        render json: data || {}
      rescue => e
        Rails.logger.error("[FixtureOddsController#show] #{e.message}")
        render json: {}
      end

      # GET /api/v1/fixture_odds/:fixture_id/live
      def live
        data = LiveScoresClient.new.fixture_odds_live(params[:fixture_id])
        render json: data || {}
      rescue => e
        Rails.logger.error("[FixtureOddsController#live] #{e.message}")
        render json: {}
      end
    end
  end
end
