module Api
  module V1
    class TodayController < BaseController
      def index
        date = parse_date(params[:date]) || Date.today
        all  = fetch_api_matches(date).sort_by { |m| m[:kickoff_at].to_s }
        render json: all
      end

      private

      def parse_date(val)
        return nil if val.blank?
        Date.parse(val)
      rescue ArgumentError
        nil
      end

      def fetch_api_matches(date)
        LiveScoresClient.new.matches_for_date(date).map { |m| normalize_api(m) }
      rescue => e
        Rails.logger.error("[TodayController] API matches failed: #{e.message}")
        []
      end

      def normalize_api(m)
        {
          id:          "ext_#{m[:external_id]}",
          external_id: m[:external_id],
          status:      m[:status],
          minute:      m[:minute],
          kickoff_at:  m[:kickoff_at],
          home_score:  m.dig(:home, :score),
          away_score:  m.dig(:away, :score),
          round:       nil,
          group_stage: nil,
          competition: {
            id:      m[:league_id],
            name:    m[:league_name],
            code:    m[:league_id].to_s,
            logo:    m[:league_logo],
            country: m[:league_country],
          },
          home_team: { name: m.dig(:home, :name), flag_url: m.dig(:home, :logo) },
          away_team: { name: m.dig(:away, :name), flag_url: m.dig(:away, :logo) },
        }
      end
    end
  end
end
