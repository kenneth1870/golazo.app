module Api
  module V1
    class ResultsController < BaseController
      include ApiMatchNormalizer

      def index
        date = parse_date(params[:date]) || Date.yesterday
        tz   = sanitize_tz(params[:tz])
        client = LiveScoresClient.new
        matches = client.matches_for_date(date, timezone: tz)
        normalized = filter_matches_for_focus(matches).map { |m| normalize_api_match(m) }
        render json: refresh_club_fixtures(normalized)
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
