module Api
  module V1
    module Admin
      class TeamsController < BaseController
        before_action :require_admin!

        def index
          teams = Team.order(:group, :name).map do |t|
            {
              id:            t.id,
              name:          t.name,
              code:          t.code,
              flag_url:      t.flag_url,
              group:         t.group,
              confederation: t.confederation,
              external_id:   t.external_id,
              matches_played: Match.where("home_team_id = ? OR away_team_id = ?", t.id, t.id)
                                   .where(status: "finished").count
            }
          end
          render json: teams
        end

        def update
          team = Team.find(params[:id])
          if team.update(team_params)
            render json: {
              id: team.id, name: team.name, code: team.code,
              flag_url: team.flag_url, group: team.group, confederation: team.confederation
            }
          else
            render json: { errors: team.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def team_params
          params.permit(:name, :code, :flag_url, :group, :confederation)
        end
      end
    end
  end
end
