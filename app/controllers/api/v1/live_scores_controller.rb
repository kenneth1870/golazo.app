module Api
  module V1
    class LiveScoresController < BaseController
      def index
        api_sports = fetch_api_sports_live
        rapid      = fetch_rapidapi_live

        # Prefer api-sports data; fill in any gaps from RapidAPI by external_id
        api_ids = api_sports.map { |m| m[:external_id] }.to_set
        extra   = rapid.reject { |m| api_ids.include?(m[:external_id]) }

        render json: api_sports + extra
      end

      private

      def fetch_api_sports_live
        ApiSportsClient.new.live_matches
      rescue => e
        Rails.logger.warn("[LiveScores] api-sports failed: #{e.message}")
        []
      end

      def fetch_rapidapi_live
        live = LiveScoresClient.new.live_matches
        live.map do |m|
          {
            external_id:  m["id"],
            league_id:    m["leagueId"],
            league_name:  nil,
            league_logo:  nil,
            league_country: nil,
            kickoff_at:   nil,
            status:       "live",
            status_short: nil,
            minute:       m.dig("status", "liveTime", "long"),
            venue:        nil,
            home: {
              name:  m.dig("home", "name"),
              logo:  nil,
              score: m.dig("home", "score"),
            },
            away: {
              name:      m.dig("away", "name"),
              logo:      nil,
              score:     m.dig("away", "score"),
              red_cards: m.dig("away", "redCards"),
            },
          }
        end
      rescue => e
        Rails.logger.warn("[LiveScores] rapidapi failed: #{e.message}")
        []
      end
    end
  end
end
