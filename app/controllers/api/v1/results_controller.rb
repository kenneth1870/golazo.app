module Api
  module V1
    class ResultsController < BaseController
      def index
        date = parse_date(params[:date]) || Date.yesterday
        render json: LiveScoresClient.new.matches_for_date(date)
      rescue => e
        Rails.logger.error("[ResultsController] #{e.message}")
        render json: []
      end

      private

      def parse_date(val)
        return nil if val.blank?
        Date.parse(val)
      rescue ArgumentError
        nil
      end
    end
  end
end
