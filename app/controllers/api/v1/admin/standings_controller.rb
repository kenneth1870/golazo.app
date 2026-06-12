module Api
  module V1
    module Admin
      class StandingsController < BaseController
        before_action :require_admin!

        def recalculate
          WorldCupSync.new(competition_code: "WC").recalculate_standings_from_results
          Rails.cache.delete("standings_WC")
          WorldCupKnockout.rebuild!
          render json: { ok: true }
        rescue => e
          render json: { error: e.message }, status: :internal_server_error
        end

        def index
          competition = Competition.find_by!(code: "WC")
          calc        = WorldCupStandings.new(competition)

          render json: calc.groups.transform_values do |ranked|
            ranked.map do |s|
              {
                team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
                group:         s.team.group,
                played:        s.played,
                won:           s.won,
                drawn:         s.drawn,
                lost:          s.lost,
                goals_for:     s.goals_for,
                goals_against: s.goals_against,
                goal_diff:     s.goal_difference,
                points:        s.points,
              }
            end
          end
        rescue ActiveRecord::RecordNotFound
          render json: {}, status: :not_found
        end
      end
    end
  end
end
