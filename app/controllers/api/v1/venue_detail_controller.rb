module Api
  module V1
    class VenueDetailController < BaseController
      def show
        expires_in 24.hours, public: true
        data = LiveScoresClient.new.venue_detail(params[:id].to_i)
        render json: data || {}
      rescue => e
        Rails.logger.error("[VenueDetailController] #{e.message}")
        render json: {}
      end
    end
  end
end
