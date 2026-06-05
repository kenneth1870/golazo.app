module Api
  module V1
    class StatsController < BaseController
      before_action :require_admin!, only: :upsert

      def upsert
        match = Match.find(params[:match_id])
        stat = match.match_stats.find_or_initialize_by(team_id: params[:stat][:team_id])

        if stat.update(stat_params)
          render json: stat
        else
          render json: { errors: stat.errors }, status: :unprocessable_entity
        end
      end

      private

      def stat_params
        params.require(:stat).permit(
          :team_id, :possession, :shots, :shots_on_target,
          :corners, :fouls, :yellow_cards, :red_cards, :offsides
        )
      end
    end
  end
end
