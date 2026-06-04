module Api
  module V1
    class TodayController < BaseController
      def index
        real_matches = fetch_real_matches
        db_matches   = fetch_db_matches

        # Merge: prefer real API data, fill with DB for WC fixtures
        render json: {
          real:  real_matches,
          local: db_matches,
        }
      end

      private

      def fetch_real_matches
        ApiSportsClient.new.today_matches
      rescue => e
        Rails.logger.error("[TodayController] real matches failed: #{e.message}")
        []
      end

      def fetch_db_matches
        Match
          .today
          .by_competition("WC")
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
          .map { |m| m.as_json }
      end
    end
  end
end
