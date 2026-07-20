module Api
  module V1
    class ResultsController < BaseController
      include ApiMatchNormalizer

      def index
        date = parse_date(params[:date]) || Date.yesterday
        tz   = sanitize_tz(params[:tz])
        matches = LiveScoresClient.new.matches_for_date(date, timezone: tz)
        render json: filter_matches_for_focus(matches)
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
