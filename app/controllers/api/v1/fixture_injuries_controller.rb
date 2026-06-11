module Api
  module V1
    class FixtureInjuriesController < BaseController
      def show
        fixture_id = params[:fixture_id].to_i
        data = LiveScoresClient.new.fixture_injuries(fixture_id)
        render json: data
      rescue => e
        Rails.logger.error("[FixtureInjuriesController] #{e.message}")
        render json: []
      end
    end
  end
end
