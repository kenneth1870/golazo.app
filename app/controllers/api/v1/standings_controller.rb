module Api
  module V1
    class StandingsController < BaseController
      def index
        competition_code = params[:competition].presence || "WC"
        ttl = competition_code == "WC" ? 3.minutes : 30.minutes

        result = Rails.cache.fetch("standings_#{competition_code}", expires_in: ttl) do
          if competition_code == "WC"
            wc_standings_from_results
          else
            external_standings(competition_code)
          end
        end

        render json: result
      end

      private

      # WC standings computed directly from our DB match results via WorldCupStandings.
      # Always accurate — no dependency on the external API's Standing table being current.
      def wc_standings_from_results
        wc = Competition.find_by(code: "WC")
        return {} unless wc

        calc = WorldCupStandings.new(wc)

        calc.groups.transform_values do |ranked|
          ranked.each_with_index.map do |s, idx|
            {
              rank:          idx + 1,
              group_name:    s.team.group,
              team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
              played:        s.played,
              won:           s.won,
              drawn:         s.drawn,
              lost:          s.lost,
              goals_for:     s.goals_for,
              goals_against: s.goals_against,
              goal_diff:     s.goal_difference,
              points:        s.points
            }
          end
        end
      end

      # Non-WC competitions: read from the Standing model (populated by SyncStandingsJob).
      def external_standings(competition_code)
        scope = Standing.includes(:team, :competition)
                        .for_competition(competition_code)
                        .where.not(group_name: [ nil, "" ])
                        .order(:group_name, :rank)

        return {} unless scope.exists?

        flat = scope.map { |s|
          {
            id:            s.id,
            rank:          s.rank,
            group_name:    s.group_name&.sub(/\AGroup\s+/i, ""),
            team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
            played:        s.played,
            won:           s.won,
            drawn:         s.drawn,
            lost:          s.lost,
            goals_for:     s.goals_for,
            goals_against: s.goals_against,
            goal_diff:     (s.goals_for || 0) - (s.goals_against || 0),
            points:        s.points
          }
        }
        flat.group_by { |s| s[:group_name] }
      end
    end
  end
end
