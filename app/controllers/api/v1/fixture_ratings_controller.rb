module Api
  module V1
    class FixtureRatingsController < BaseController
      def show
        fixture_id = params[:fixture_id].to_i
        data = LiveScoresClient.new.player_ratings(fixture_id)
        render json: data
      rescue => e
        Rails.logger.error("[FixtureRatingsController] #{e.message}")
        render json: []
      end
    end
  end
end
