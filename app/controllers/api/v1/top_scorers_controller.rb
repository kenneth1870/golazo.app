module Api
  module V1
    class TopScorersController < BaseController
      def index
        competition_code = params[:competition] || "WC"

        scorers = FootballDataClient.new.scorers(competition_code, limit: 20)

        render json: scorers.map { |s|
          {
            player: {
              name:        s.dig("player", "name"),
              nationality: s.dig("player", "nationality"),
              photo:       nil
            },
            team: {
              name:    s.dig("team", "name"),
              crest:   s.dig("team", "crest"),
              tla:     s.dig("team", "tla")
            },
            goals:   s["goals"],
            assists: s["assists"],
            played:  s["playedMatches"]
          }
        }
      end
    end
  end
end
