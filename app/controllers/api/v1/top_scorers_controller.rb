module Api
  module V1
    class TopScorersController < BaseController
      def index
        league_id = params[:league_id]
        season_id = params[:season_id]

        scorers = LiveScoresClient.new.top_scorers(league_id, season_id)

        render json: scorers.map { |s|
          {
            player: {
              name:        s.dig("player", "name") || s["playerName"],
              nationality: s.dig("player", "nationality") || s["nationality"],
              photo:       s.dig("player", "photo"),
            },
            team: {
              name:  s.dig("team", "name") || s["teamName"],
              crest: s.dig("team", "logo") || s["teamLogo"],
              tla:   s.dig("team", "tla"),
            },
            goals:   s["goals"]   || s["goalsScored"],
            assists: s["assists"],
            played:  s["played"]  || s["playedMatches"],
          }
        }
      rescue => e
        Rails.logger.error("[TopScorersController] #{e.message}")
        render json: []
      end
    end
  end
end
