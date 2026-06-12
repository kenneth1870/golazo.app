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
          .limit(100)
        render json: matches.map { |m|
          m.as_json(
            only:    %i[id external_id status kickoff_at home_score away_score round group_stage bracket_pos],
            include: {
              home_team:   { only: %i[id name code flag_url] },
              away_team:   { only: %i[id name code flag_url] },
              competition: { only: %i[id name code logo country] }
            }
          )
        }
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
