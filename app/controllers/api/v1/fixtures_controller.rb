module Api
  module V1
    class FixturesController < BaseController
      def index
        date = parse_date(params[:date]) || Date.tomorrow
        render json: ApiSportsClient.new.matches_for_date(date)
      rescue => e
        Rails.logger.error("[FixturesController] #{e.message}")
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
