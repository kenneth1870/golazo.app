module Api
  module V1
    class StandingsController < BaseController
      def index
        groups = Standing.includes(:team).order(:group_name, :rank).group_by(&:group_name)
        render json: groups.transform_values { |standings|
          standings.map { |s|
            {
              rank:          s.rank,
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
        }
      end
    end
  end
end
