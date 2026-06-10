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
      TRACKED_PLAYERS = [
        { id: 276,  name: "Neymar"        },
        { id: 306,  name: "Messi"         },
        { id: 278,  name: "Mbappé"        },
        { id: 874,  name: "Salah"         },
        { id: 284,  name: "Benzema"       },
        { id: 286,  name: "De Bruyne"     },
        { id: 909,  name: "Haaland"       },
        { id: 521,  name: "Rodri"         },
        { id: 35845, name: "Bellingham"   },
        { id: 1485, name: "Pedri"         },
        { id: 37145, name: "Vinicius Jr"  },
        { id: 184,  name: "Lewandowski"   },
        { id: 290,  name: "Kane"          },
        { id: 39362, name: "Yamal"        },
        { id: 18765, name: "Pulisic"      },
        { id: 19220, name: "Reyna"        },
        { id: 47409, name: "Saka"         },
        { id: 658,  name: "Suárez"        },
        { id: 19817, name: "Félix"        },
        { id: 22466, name: "Gavi"         },
      ].freeze

      CUTOFF_DATE = Date.new(2025, 1, 1).freeze

      def index
        limit = [[params[:limit].to_i, 1].max, 100].min
        limit = 40 if limit == 0

        since = begin
          Date.parse(params[:since].to_s)
        rescue
          CUTOFF_DATE
        end

        transfers = Rails.cache.fetch("transfers_hub_v2", expires_in: 6.hours) do
          fetch_all_transfers
        end

        filtered = transfers
          .select { |tr| tr[:date] && Date.parse(tr[:date].to_s) >= since rescue false }
          .sort_by { |tr| tr[:date] }.reverse
          .first(limit)

        render json: filtered
      rescue => e
        Rails.logger.error("[TransfersController] #{e.message}")
        render json: []
      end

      private

      def fetch_all_transfers
        client = LiveScoresClient.new
        threads = TRACKED_PLAYERS.map do |player|
          Thread.new do
            begin
              moves = client.player_transfers(player[:id])
              Array(moves).filter_map do |tr|
                date_str = tr.dig("date") || tr["date"]
                next unless date_str
                date = Date.parse(date_str.to_s) rescue nil
                next unless date && date >= CUTOFF_DATE

                {
                  player_id:   player[:id],
                  player_name: player[:name],
                  date:        date_str,
                  type:        tr["type"].to_s,
                  from:        tr["from"],
                  to:          tr["to"],
                }
              end
            rescue => e
              Rails.logger.warn("[TransfersController] player #{player[:id]}: #{e.message}")
              []
            end
          end
        end

        threads.flat_map { |t| t.join(8)&.value || [] }
               .sort_by { |tr| tr[:date] }.reverse
      end
    end
  end
end
