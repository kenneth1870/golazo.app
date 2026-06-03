module Api
  module V1
    class LiveScoresController < BaseController
      # Returns live scores directly from RapidAPI (no DB — raw, fastest possible)
      def index
        client = LiveScoresClient.new
        live   = client.live_matches

        render json: live.map { |m|
          {
            external_id:  m["id"],
            league_id:    m["leagueId"],
            minute:       m.dig("status", "liveTime", "long"),
            home: {
              name:  m.dig("home", "name"),
              score: m.dig("home", "score"),
            },
            away: {
              name:  m.dig("away", "name"),
              score: m.dig("away", "score"),
              red_cards: m.dig("away", "redCards"),
            },
            status: m.dig("status", "scoreStr"),
            started:  m.dig("status", "started"),
            finished: m.dig("status", "finished"),
          }
        }
      end
    end
  end
end
