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
        competition = params[:competition].to_s.upcase
        if competition == "WC"
          # WorldCupScorers aggregates from live match events — always current.
          # API-Football topscorers lags hours after match end, so use it as a
          # fallback when our local data is empty (early in tournament).
          local = WorldCupScorers.scorers(competition)
          if local.any?
            render json: local
          else
            raw = LiveScoresClient.new.top_scorers(*league_season)
            render json: normalize_players(raw)
          end
        else
          raw = LiveScoresClient.new.top_scorers(*league_season)
          render json: normalize_players(raw)
        end
      rescue => e
        Rails.logger.error("[TopScorersController#index] #{e.message}")
        render json: WorldCupScorers.scorers("WC") rescue render json: []
      end

      def assists
        competition = params[:competition].to_s.upcase
        if competition == "WC"
          local = WorldCupScorers.assists(competition)
          if local.any?
            render json: local
          else
            raw = LiveScoresClient.new.top_assists(*league_season)
            render json: normalize_players(raw)
          end
        else
          raw = LiveScoresClient.new.top_assists(*league_season)
          render json: normalize_players(raw)
        end
      rescue => e
        Rails.logger.error("[TopScorersController#assists] #{e.message}")
        render json: WorldCupScorers.assists("WC") rescue render json: []
      end

      def cards
        competition = params[:competition].to_s.upcase
        card_type   = params[:type] == "red" ? :red : :yellow
        if competition == "WC"
          local = WorldCupScorers.cards(competition, type: card_type)
          if local.any?
            render json: local
          else
            api_method = params[:type] == "red" ? :top_red_cards : :top_yellow_cards
            raw = LiveScoresClient.new.public_send(api_method, *league_season)
            render json: normalize_players(raw, stat_key: params[:type] == "red" ? :red_cards : :yellow_cards)
          end
        else
          api_method = params[:type] == "red" ? :top_red_cards : :top_yellow_cards
          raw = LiveScoresClient.new.public_send(api_method, *league_season)
          render json: normalize_players(raw, stat_key: params[:type] == "red" ? :red_cards : :yellow_cards)
        end
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
