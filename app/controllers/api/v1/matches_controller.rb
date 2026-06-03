module Api
  module V1
    class MatchesController < BaseController
      def index
        matches = case params[:filter]
        when "live"    then Match.live
        when "today"   then Match.today
        when "upcoming" then Match.upcoming.limit(20)
        else Match.order(kickoff_at: :asc)
        end

        matches = matches.includes(:home_team, :away_team, :goals, :match_stats)
        render json: matches
      end

      def show
        match = Match.includes(:home_team, :away_team, goals: :team, match_stats: :team).find(params[:id])
        render json: match
      end

      def update
        match = Match.find(params[:id])
        if match.update(match_params)
          ActionCable.server.broadcast("match_#{match.id}", {
            type: "score_update",
            home_score: match.home_score,
            away_score: match.away_score,
            status: match.status
          })
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
