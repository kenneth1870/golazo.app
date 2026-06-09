module Api
  module V1
    class TopScorersController < BaseController
      # API-Football v3 league IDs + seasons
      COMPETITION_IDS = {
        "WC"  => { league_id: 1,   season_id: 2026 },
        "CL"  => { league_id: 2,   season_id: 2024 },
        "PL"  => { league_id: 39,  season_id: 2024 },
        "BL1" => { league_id: 78,  season_id: 2024 },
        "SA"  => { league_id: 135, season_id: 2024 },
        "LAL" => { league_id: 140, season_id: 2024 },
        "L1"  => { league_id: 61,  season_id: 2024 },
      }.freeze

      def index
        ids = COMPETITION_IDS[params[:competition]]
        league_id = ids&.dig(:league_id) || params[:league_id]
        season_id = ids&.dig(:season_id) || params[:season_id]

        scorers = LiveScoresClient.new.top_scorers(league_id, season_id)

        # API-Football v3 shape:
        # { player: {id, name, photo}, statistics: [{team: {name, logo}, goals: {total, assists}, games: {appearences}}] }
        render json: scorers.map { |s|
          stats = s.dig("statistics", 0) || {}
          {
            player: {
              id:          s.dig("player", "id"),
              name:        s.dig("player", "name"),
              nationality: s.dig("player", "nationality"),
              photo:       s.dig("player", "photo"),
            },
            team: {
              name:  stats.dig("team", "name"),
              crest: stats.dig("team", "logo"),
              tla:   nil,
            },
            goals:   stats.dig("goals", "total"),
            assists: stats.dig("goals", "assists"),
            played:  stats.dig("games", "appearences"),
          }
        }
      rescue => e
        Rails.logger.error("[TopScorersController] #{e.message}")
        render json: []
      end
    end
  end
end
