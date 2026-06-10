module Api
  module V1
    # GET /api/v1/transfers
    #
    # Returns recent transfer activity for a curated list of high-profile
    # World Cup 2026 players. Results are cached for 6 hours to avoid
    # hammering the upstream API.
    #
    # Query params:
    #   limit  — max results (default 40)
    #   since  — ISO date string; only transfers on/after this date
    class TransfersController < BaseController
      # Curated list of high-profile WC 2026 players to track.
      # Mix of goal scorers, marquee names, and players in the news.
      # IDs verified against API-Football v3 (api-sports.io)
      TRACKED_PLAYERS = [
        { id: 154,    name: "Messi"         },
        { id: 278,    name: "Mbappé"        },
        { id: 1100,   name: "Haaland"       },
        { id: 129718, name: "Bellingham"    },
        { id: 762,    name: "Vinícius Jr"   },
        { id: 276,    name: "Neymar"        },
        { id: 306,    name: "Salah"         },
        { id: 629,    name: "De Bruyne"     },
        { id: 184,    name: "Kane"          },
        { id: 44,     name: "Rodri"         },
        { id: 386828, name: "Yamal"         },
        { id: 133609, name: "Pedri"         },
        { id: 296667, name: "Gavi"          },
        { id: 1460,   name: "Saka"          },
        { id: 17,     name: "Pulisic"       },
        { id: 161921, name: "G. Reyna"      },
        { id: 583,    name: "João Félix"    },
        { id: 286,    name: "Lewandowski"   },
      ].freeze

      # Show transfers back to 2022 — WC 2026 players mostly moved in 2022-24
      CUTOFF_DATE = Date.new(2022, 1, 1).freeze

      def index
        limit = params[:limit].present? ? [[params[:limit].to_i, 1].max, 100].min : 60

        transfers = Rails.cache.fetch("transfers_hub_v4", expires_in: 6.hours) do
          fetch_all_transfers
        end

        render json: transfers.first(limit)
      rescue => e
        Rails.logger.error("[TransfersController] #{e.message}")
        render json: []
      end

      private

      def fetch_all_transfers
        client  = LiveScoresClient.new
        results = []

        # Sequential fetches with a small delay between API calls.
        # Avoids rate-limit rejections that happen when 18 threads hammer
        # the API simultaneously. The hub result is cached for 6 hours so
        # this ~5s build cost only occurs once per cache window.
        TRACKED_PLAYERS.each do |player|
          begin
            moves = Array(client.player_transfers(player[:id]))
            shaped = moves.filter_map do |tr|
              date_str = tr[:date] || tr["date"]
              next unless date_str
              {
                player_id:   player[:id],
                player_name: player[:name],
                date:        date_str,
                type:        (tr[:type] || tr["type"]).to_s,
                from:        tr[:from] || tr["from"],
                to:          tr[:to]   || tr["to"],
              }
            end.sort_by { |t| t[:date] }.reverse

            # Prefer transfers since CUTOFF; fall back to most recent 1
            recent = shaped.select { |t| t[:date] >= CUTOFF_DATE.to_s rescue false }
            player_results = recent.empty? ? shaped.first(1) : recent.first(3)

            Rails.logger.info("[TransfersController] #{player[:name]} (#{player[:id]}): #{player_results.size} result(s)")
            results.concat(player_results)

            sleep(0.15) # 150ms gap to stay under the API rate limit
          rescue => e
            Rails.logger.warn("[TransfersController] player #{player[:id]} #{player[:name]}: #{e.message}")
          end
        end

        results.sort_by { |tr| tr[:date] }.reverse
      end
    end
  end
end
