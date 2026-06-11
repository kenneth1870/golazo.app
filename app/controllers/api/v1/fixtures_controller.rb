module Api
  module V1
    class FixturesController < BaseController
      def index
        date    = parse_date(params[:date]) || Date.today
        tz      = sanitize_tz(params[:tz])
        matches = Match
          .where(kickoff_at: local_day_range(date, tz))
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
        render json: matches
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

      def sanitize_tz(val)
        return "UTC" if val.blank?
        TZInfo::Timezone.get(val)
        val
      rescue TZInfo::InvalidTimezoneIdentifier
        "UTC"
      end

      # Returns a UTC Range covering the full local calendar day in the given timezone.
      def local_day_range(date, timezone)
        tz         = TZInfo::Timezone.get(timezone)
        day_start  = tz.local_time(date.year, date.month, date.day, 0, 0, 0)
        day_end    = tz.local_time(date.year, date.month, date.day, 23, 59, 59)
        day_start.utc..day_end.utc
      rescue
        date.all_day
      end
    end
  end
end
