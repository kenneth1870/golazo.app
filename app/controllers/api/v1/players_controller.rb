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

      # GET /api/v1/players/:id?season=2026&league=1
      def show
        api_key = ENV["APISPORTS_KEY"].presence
        return render json: player_not_found unless api_key

        player_id = params[:id]
        player    = if params[:league].present?
          fetch_player(player_id, params[:season], params[:league])
        elsif AppFocus.wc_paused?
          find_player_in_featured_leagues(player_id, params[:season])
        else
          fetch_player(player_id, params[:season] || 2026, params[:league] || 1)
        end

        return render json: player_not_found, status: :not_found unless player

        render json: serialize_player(player)
      rescue => e
        Rails.logger.error("[PlayersController#show] #{e.message}")
        render json: player_not_found, status: :service_unavailable
      end


      # GET /api/v1/players/:id/trophies
      def trophies
        render json: LiveScoresClient.new.player_trophies(params[:id])
      rescue => e
        Rails.logger.error("[PlayersController#trophies] #{e.message}")
        render json: []
      end

      # GET /api/v1/players/:id/sidelined
      def sidelined
        render json: LiveScoresClient.new.player_sidelined(params[:id])
      rescue => e
        Rails.logger.error("[PlayersController#sidelined] #{e.message}")
        render json: []
      end

      private

      def normalize_player(p)
        {
          id:   p["id"] || p.dig("player", "id"),
          name: p["name"] || p.dig("player", "name"),
          team: p.dig("team", "name") || p["teamName"],
          photo: p["photo"] || p.dig("player", "photo")
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
            logo: team["logo"]
          },
          stats: {
            appearances:  games["appearences"],
            minutes:      games["minutes"],
            rating:       games["rating"],
            goals:        goals["total"],
            assists:      goals["assists"],
            yellow_cards: cards["yellow"],
            red_cards:    cards["red"],
            key_passes:   passes["key"]
          }
        }
      end

      def player_not_found
        { error: "player_not_found" }
      end

      def fetch_player(player_id, season, league)
        resp = api_conn.get("/players", {
          id:     player_id,
          season: season || AppFocus.season_for("PL"),
          league: league
        })
        return nil unless resp.success?

        data = JSON.parse(resp.body)
        data.dig("response", 0)
      end

      def find_player_in_featured_leagues(player_id, season)
        AppFocus::FEATURED_CLUB_CODES.each do |code|
          league_id = AppFocus.league_id_for(code)
          next unless league_id

          s = season || AppFocus.season_for(code)
          player = fetch_player(player_id, s, league_id)
          return player if player
        end
        nil
      end

      def api_conn
        @api_conn ||= Faraday.new("https://v3.football.api-sports.io") do |f|
          f.headers["x-apisports-key"] = ENV["APISPORTS_KEY"]
          f.adapter Faraday.default_adapter
        end
      end
    end
  end
end
