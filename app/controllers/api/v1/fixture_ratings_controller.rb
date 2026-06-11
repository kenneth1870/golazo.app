module Api
  module V1
    class FixtureRatingsController < BaseController
      def show
        data = LiveScoresClient.new.player_ratings(resolved_fixture_id)
        render json: data
      rescue => e
        Rails.logger.error("[FixtureRatingsController] #{e.message}")
        render json: []
      end

      private

      def resolved_fixture_id
        @resolved_fixture_id ||= resolve_to_api_football_id(params[:fixture_id].to_s)
      end

      def resolve_to_api_football_id(raw)
        if raw.start_with?("db-")
          db_id = raw.sub("db-", "").to_i
          match = Match.includes(:home_team, :away_team).find_by(id: db_id)
          if match&.home_team && match&.away_team && match&.kickoff_at
            detail = ApiSportsClient.new.match_detail(
              home_name:  match.home_team.name,
              away_name:  match.away_team.name,
              kickoff_at: match.kickoff_at,
            )
            return detail&.dig(:fixture, "fixture", "id") || 0
          end
          return 0
        end
        raw.to_i
      end
    end
  end
end
