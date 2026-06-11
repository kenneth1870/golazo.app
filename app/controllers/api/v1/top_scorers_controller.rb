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
        "L1"  => { league_id: 61,  season_id: 2024 }
      }.freeze

      def index
        render json: normalize_players(LiveScoresClient.new.top_scorers(*league_season))
      rescue => e
        Rails.logger.error("[TopScorersController#index] #{e.message}")
        render json: []
      end

      def assists
        render json: normalize_players(LiveScoresClient.new.top_assists(*league_season))
      rescue => e
        Rails.logger.error("[TopScorersController#assists] #{e.message}")
        render json: []
      end

      def cards
        type = params[:type] == "red" ? :top_red_cards : :top_yellow_cards
        render json: normalize_players(LiveScoresClient.new.public_send(type, *league_season), stat_key: params[:type] == "red" ? :red_cards : :yellow_cards)
      rescue => e
        Rails.logger.error("[TopScorersController#cards] #{e.message}")
        render json: []
      end

      private

      def league_season
        ids = COMPETITION_IDS[params[:competition]]
        [
          ids&.dig(:league_id) || params[:league_id],
          ids&.dig(:season_id) || params[:season_id]
        ]
      end

      def normalize_players(raw, stat_key: nil)
        raw.map do |s|
          stats = s.dig("statistics", 0) || {}
          value = case stat_key
          when :yellow_cards then stats.dig("cards", "yellow")
          when :red_cards    then stats.dig("cards", "red")
          else stats.dig("goals", "assists")
          end
          {
            player: {
              id:          s.dig("player", "id"),
              name:        s.dig("player", "name"),
              nationality: s.dig("player", "nationality"),
              photo:       s.dig("player", "photo")
            },
            team: {
              name:  stats.dig("team", "name"),
              crest: stats.dig("team", "logo")
            },
            goals:   stats.dig("goals", "total"),
            assists: stats.dig("goals", "assists"),
            yellow_cards: stats.dig("cards", "yellow"),
            red_cards:    stats.dig("cards", "red"),
            played:  stats.dig("games", "appearences"),
            value:   value
          }
        end
      end
    end
  end
end
