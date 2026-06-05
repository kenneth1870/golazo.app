module Api
  module V1
    class StandingsController < BaseController
      def index
        competition_code = params[:competition].presence || "WC"
        scope = Standing.includes(:team, :competition)
                        .for_competition(competition_code)
                        .where.not(group_name: [nil, ""])
                        .order(:group_name, :rank)

        if scope.exists?
          flat = scope.map { |s|
            {
              id:            s.id,
              rank:          s.rank,
              group_name:    s.group_name,
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
          render json: flat.group_by { |s| s[:group_name] }
        else
          # Before tournament begins: build standings skeleton from seeded WC teams
          wc_teams = Team.where.not(group: [nil, ""]).order(:group, :name)
          grouped = wc_teams.group_by(&:group).transform_values.with_index do |teams, _|
            teams.each_with_index.map do |t, i|
              {
                rank:          i + 1,
                group_name:    t.group,
                team:          { id: t.id, name: t.name, code: t.code, flag_url: t.flag_url },
                played: 0, won: 0, drawn: 0, lost: 0,
                goals_for: 0, goals_against: 0, goal_diff: 0, points: 0
              }
            end
          end
          render json: grouped
        end
      end
    end
  end
end
