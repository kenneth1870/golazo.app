module Api
  module V1
    class LiveScoresController < BaseController
      def index
        live = LiveScoresClient.new.live_matches
        render json: live.map { |m| normalize(m) }
      rescue => e
        Rails.logger.error("[LiveScoresController] #{e.message}")
        render json: []
      end

      # Lightweight endpoint — returns just the live match count.
      # Used by LiveContext badge so it doesn't have to fetch all of /today.
      def count
        count = Rails.cache.fetch("live_match_count", expires_in: 30.seconds) do
          LiveScoresClient.new.live_matches.length
        rescue
          0
        end
        render json: { count: count }
      end

      private

      def normalize(m)
        status_map = {
          1 => "scheduled", 2 => "live", 3 => "live", 4 => "live",
          5 => "live", 6 => "finished", 7 => "finished", 8 => "finished",
          11 => "live", 12 => "live",
        }
        code = m.dig("status", "code").to_i

        {
          external_id:    m["id"],
          league_id:      m["leagueId"],
          league_name:    m.dig("league", "name"),
          league_logo:    m.dig("league", "logo"),
          league_country: m.dig("league", "country"),
          kickoff_at:     nil,
          status:         status_map[code] || "scheduled",
          status_short:   nil,
          minute:         m.dig("status", "liveTime", "long"),
          venue:          nil,
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
    end
  end
end
