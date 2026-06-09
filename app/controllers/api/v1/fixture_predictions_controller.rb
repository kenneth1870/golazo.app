module Api
  module V1
    class FixturePredictionsController < BaseController
      # GET /api/v1/fixture_predictions/:fixture_id
      def show
        data = LiveScoresClient.new.fixture_predictions(params[:fixture_id])
        render json: data || {}
      rescue => e
        Rails.logger.error("[FixturePredictionsController] #{e.message}")
        render json: {}
      end
    end
  end
end
