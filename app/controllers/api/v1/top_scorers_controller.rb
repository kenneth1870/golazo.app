module Api
  module V1
    class TopScorersController < BaseController
      # FotMob league/season IDs for well-known competitions
      COMPETITION_IDS = {
        "WC"  => { league_id: 4,   season_id: 2026 },
        "CL"  => { league_id: 244, season_id: 2025 },
        "PL"  => { league_id: 47,  season_id: 2025 },
        "BL1" => { league_id: 54,  season_id: 2025 },
        "SA"  => { league_id: 55,  season_id: 2025 },
        "LAL" => { league_id: 87,  season_id: 2025 },
        "L1"  => { league_id: 53,  season_id: 2025 },
      }.freeze

      def index
        ids = COMPETITION_IDS[params[:competition]]
        league_id = ids&.dig(:league_id) || params[:league_id]
        season_id = ids&.dig(:season_id) || params[:season_id]

        scorers = LiveScoresClient.new.top_scorers(league_id, season_id)

        render json: scorers.map { |s|
          {
            player: {
              id:          s.dig("player", "id"),
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
