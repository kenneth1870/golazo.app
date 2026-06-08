module Api
  module V1
    class TeamsController < BaseController
      def index
        teams = Team.order(:group, :name)
        teams = teams.where.not(group: [nil, ""]) if params[:competition] == "WC" || params[:wc] == "1"
        render json: teams
      end

      def show
        team = Team.find(params[:id])
        matches = team.matches.includes(:home_team, :away_team).order(:kickoff_at)

        # Tournament goal scorers from our own DB (no external API needed)
        scorers = team.goals
                      .where.not(player_name: [nil, ""])
                      .where(goal_type: [nil, "regular", "penalty", "own_goal"])
                      .group(:player_name, :goal_type)
                      .count
                      .each_with_object({}) do |((name, type), count), h|
                        h[name] ||= { name: name, goals: 0, own_goals: 0 }
                        if type == "own_goal"
                          h[name][:own_goals] += count
                        else
                          h[name][:goals] += count
                        end
                      end
                      .values
                      .select { |s| s[:goals] > 0 }
                      .sort_by { |s| -s[:goals] }

        # Tournament summary stats
        finished_matches = matches.select { |m| m.status == "finished" }
        home_fin = finished_matches.select { |m| m.home_team_id == team.id }
        away_fin = finished_matches.select { |m| m.away_team_id == team.id }

        goals_scored   = home_fin.sum { |m| m.home_score.to_i } + away_fin.sum { |m| m.away_score.to_i }
        goals_conceded = home_fin.sum { |m| m.away_score.to_i } + away_fin.sum { |m| m.home_score.to_i }
        clean_sheets   = home_fin.count { |m| m.away_score.to_i == 0 } + away_fin.count { |m| m.home_score.to_i == 0 }

        tournament_stats = {
          played:        finished_matches.count,
          goals_scored:  goals_scored,
          goals_conceded: goals_conceded,
          clean_sheets:  clean_sheets,
          goal_diff:     goals_scored - goals_conceded,
        }

        render json: team.as_json.merge(
          matches: matches,
          scorers: scorers,
          tournament_stats: tournament_stats
        )
      end

      # GET /api/v1/teams/:id/squad
      # Fetches squad from API-Sports v3, cached for 24h
      def squad
        team = Team.find(params[:id])
        api_key = ENV["FOOTBALL_API_KEY"].presence

        unless api_key && team.external_id.present?
          return render json: { players: [], coach: nil }
        end

        cache_key = "team_squad_#{team.external_id}"
        data = Rails.cache.fetch(cache_key, expires_in: 24.hours) do
          resp = Faraday.new("https://v3.football.api-sports.io") do |f|
            f.headers["x-apisports-key"] = api_key
          end.get("/players/squads", { team: team.external_id })

          if resp.success?
            body = JSON.parse(resp.body)
            raw  = body.dig("response", 0) || {}
            players = Array(raw["players"]).map do |p|
              {
                id:       p["id"],
                name:     p["name"],
                age:      p["age"],
                number:   p["number"],
                position: p["position"],
                photo:    p["photo"],
              }
            end
            { players: players, coach: nil }
          else
            { players: [], coach: nil }
          end
        rescue => e
          Rails.logger.error("[TeamsController#squad] #{e.message}")
          { players: [], coach: nil }
        end

        render json: data
      end
    end
  end
end
