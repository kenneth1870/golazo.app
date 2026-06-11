module Api
  module V1
    class FixturePredictionsController < BaseController
      # GET /api/v1/fixture_predictions/:fixture_id
      def show
        fixture_id = params[:fixture_id].to_i
        client     = LiveScoresClient.new

        data = client.fixture_predictions(fixture_id)

        # If the given ID returns nothing (e.g. it's a football-data.org ID),
        # look up the local DB match and resolve the correct API-Football fixture
        # ID via ApiSportsClient (team-name + kickoff search).
        if data.nil?
          match = Match.includes(:home_team, :away_team).find_by(external_id: fixture_id)
          if match&.home_team && match&.away_team && match&.kickoff_at
            apisports_detail = ApiSportsClient.new.match_detail(
              home_name:  match.home_team.name,
              away_name:  match.away_team.name,
              kickoff_at: match.kickoff_at,
            )
            resolved_id = apisports_detail&.dig(:fixture, "fixture", "id")
            data = client.fixture_predictions(resolved_id) if resolved_id
          end
        end

        render json: data || {}
      rescue => e
        Rails.logger.error("[FixturePredictionsController] #{e.message}")
        render json: {}
      end
    end
  end
end
