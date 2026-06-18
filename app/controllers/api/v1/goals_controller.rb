module Api
  module V1
    class GoalsController < BaseController
      before_action :require_admin!, only: :create

      def create
        match = Match.find(params[:match_id])
        goal = match.goals.build(goal_params)

        if goal.team_id.present? && ![ match.home_team_id, match.away_team_id ].include?(goal.team_id)
          return render json: { errors: { team: [ "must be one of this match's teams" ] } }, status: :unprocessable_entity
        end

        if goal.save
          render json: goal, status: :created
        else
          render json: { errors: goal.errors }, status: :unprocessable_entity
        end
      end

      private

      def goal_params
        params.require(:goal).permit(:team_id, :player_name, :minute, :goal_type)
      end
    end
  end
end
