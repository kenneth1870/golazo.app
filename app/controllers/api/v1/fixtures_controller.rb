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

    end
  end
end
