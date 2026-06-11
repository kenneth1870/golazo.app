module Api
  module V1
    class FixtureOddsController < BaseController
      # GET /api/v1/fixture_odds/:fixture_id
      def show
        data = LiveScoresClient.new.fixture_odds(resolved_fixture_id)
        render json: data || {}
      rescue => e
        Rails.logger.error("[FixtureOddsController#show] #{e.message}")
        render json: {}
      end

      # GET /api/v1/fixture_odds/:fixture_id/live
      def live
        data = LiveScoresClient.new.fixture_odds_live(resolved_fixture_id)
        render json: data || {}
      rescue => e
        Rails.logger.error("[FixtureOddsController#live] #{e.message}")
        render json: {}
      end

      private

      # Returns the API-Football fixture ID to use. If the given param ID is a
      # football-data.org ID (no result from API), resolves it via team-name search.
      def resolved_fixture_id
        @resolved_fixture_id ||= begin
          fixture_id = params[:fixture_id].to_i

          # Quick check: can we get any data with this ID?
          match = Match.includes(:home_team, :away_team).find_by(external_id: fixture_id)
          if match&.home_team && match&.away_team && match&.kickoff_at
            detail = ApiSportsClient.new.match_detail(
              home_name:  match.home_team.name,
              away_name:  match.away_team.name,
              kickoff_at: match.kickoff_at,
            )
            detail&.dig(:fixture, "fixture", "id") || fixture_id
          else
            fixture_id
          end
        end
      rescue => e
        Rails.logger.warn("[FixtureOddsController] ID resolution failed: #{e.message}")
        params[:fixture_id].to_i
      end
    end
  end
end
