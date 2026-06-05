module Api
  module V1
    class MatchesController < BaseController
      def index
        scope = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)

        # Competition filter
        scope = scope.by_competition(params[:competition]) if params[:competition].present?

        # Group filter
        scope = scope.by_group(params[:group]) if params[:group].present?

        scope = case params[:filter]
                when "live"     then scope.live
                when "today"    then scope.today
                when "upcoming" then scope.upcoming.limit(30)
                else scope.order(kickoff_at: :asc).limit(200)
                end

        render json: scope
      end

      def show
        match = Match.includes(:home_team, :away_team, :competition,
                               goals: :team, match_stats: :team).find(params[:id])
        render json: match
      end

      def update
        match = Match.find(params[:id])
        if match.update(match_params)
          ActionCable.server.broadcast("match_#{match.id}", {
            type:       "score_update",
            home_score: match.home_score,
            away_score: match.away_score,
            status:     match.status
          })
          RecalculateStandingsJob.perform_later if match.status == "finished" && match.competition&.code == "WC"
          render json: match
        else
          render json: { errors: match.errors }, status: :unprocessable_entity
        end
      end

      private

      def match_params
        params.require(:match).permit(:home_score, :away_score, :status)
      end
    end
  end
end
