module Api
  module V1
    class ResultsController < BaseController
      def index
        date = parse_date(params[:date]) || Date.yesterday
        tz   = sanitize_tz(params[:tz])
        render json: LiveScoresClient.new.matches_for_date(date, timezone: tz)
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

      def sanitize_tz(val)
        return "UTC" if val.blank?
        TZInfo::Timezone.get(val)
        val
      rescue TZInfo::InvalidTimezoneIdentifier
        "UTC"
      end
    end
  end
end
