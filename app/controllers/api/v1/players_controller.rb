module Api
  module V1
    class PlayersController < BaseController
      # GET /api/v1/players/search?q=mbappe
      def search
        query = params[:q].to_s.strip
        return render json: [] if query.length < 2

        client = LiveScoresClient.new
        results = client.search_players(query)
        render json: Array(results).first(10).map { |p| normalize_player(p) }
      rescue => e
        Rails.logger.error("[PlayersController#search] #{e.message}")
        render json: []
      end

      # GET /api/v1/players/:id?season=2026&league=4
      def show
        api_key = ENV["APISPORTS_KEY"].presence
        return render json: player_not_found unless api_key

        player_id = params[:id]
        season    = params[:season] || 2026
        league    = params[:league] || 4   # WC 2026

        resp = Faraday.new("https://v3.football.api-sports.io") do |f|
          f.headers["x-apisports-key"] = api_key
          f.adapter Faraday.default_adapter
        end.get("/players", { id: player_id, season: season, league: league })

        unless resp.success?
          return render json: player_not_found, status: :not_found
        end

        data = JSON.parse(resp.body)
        player = data.dig("response", 0)
        return render json: player_not_found, status: :not_found unless player

        render json: serialize_player(player)
      rescue => e
        Rails.logger.error("[PlayersController#show] #{e.message}")
        render json: player_not_found, status: :service_unavailable
      end

      private

      def normalize_player(p)
        {
          id:   p["id"] || p.dig("player", "id"),
          name: p["name"] || p.dig("player", "name"),
          team: p.dig("team", "name") || p["teamName"],
          photo: p["photo"] || p.dig("player", "photo"),
        }
      end

      def serialize_player(p)
        info  = p["player"]  || {}
        stats = Array(p["statistics"]).first || {}
        team  = stats.dig("team") || {}
        games = stats.dig("games") || {}
        goals = stats.dig("goals") || {}
        cards = stats.dig("cards") || {}
        passes = stats.dig("passes") || {}

        {
          id:           info["id"],
          name:         info["name"],
          firstname:    info["firstname"],
          lastname:     info["lastname"],
          age:          info["age"],
          nationality:  info["nationality"],
          photo:        info["photo"],
          position:     games["position"],
          team: {
            id:   team["id"],
            name: team["name"],
            logo: team["logo"],
          },
          stats: {
            appearances:  games["appearences"],
            minutes:      games["minutes"],
            rating:       games["rating"],
            goals:        goals["total"],
            assists:      goals["assists"],
            yellow_cards: cards["yellow"],
            red_cards:    cards["red"],
            key_passes:   passes["key"],
          }
        }
      end

      def player_not_found
        { error: "player_not_found" }
      end
    end
  end
end
