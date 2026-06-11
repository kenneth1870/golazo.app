module Api
  module V1
    class VenueDetailController < BaseController
      def show
        data = LiveScoresClient.new.venue_detail(params[:id].to_i)
        render json: data || {}
      rescue => e
        Rails.logger.error("[VenueDetailController] #{e.message}")
        render json: {}
      end
    end
  end
end
