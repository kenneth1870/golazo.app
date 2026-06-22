module Api
  module V1
    class MatchesController < BaseController
      before_action :require_admin!, only: :update

      def index
        # Exclude goals/match_stats from the index includes — they are only
        # needed on the show action.  Loading them for 200 matches produces a
        # massive JSON payload; callers that need detail should use #show.
        scope = Match.includes(:home_team, :away_team, :competition)

        # Competition filter
        scope = scope.by_competition(params[:competition]) if params[:competition].present?

        # Group filter
        scope = scope.by_group(params[:group]) if params[:group].present?

        scope = case params[:filter]
        when "live"     then scope.live
        when "today"
          tz   = sanitize_tz(params[:tz])
          range = tz ? local_day_range(Date.today, tz) : Time.current.beginning_of_day..Time.current.end_of_day
          scope.where(kickoff_at: range).order(:kickoff_at)
        when "upcoming" then scope.upcoming.limit(30)
        else scope.order(kickoff_at: :asc).limit(200)
        end

        render json: scope.map { |m|
          m.as_json(
            only:    %i[id external_id status kickoff_at home_score away_score home_slot away_slot bracket_pos group_stage],
            include: {
              home_team:   { only: %i[id name code flag_url] },
              away_team:   { only: %i[id name code flag_url] },
              competition: { only: %i[id name code logo country] }
            }
          ).merge("home_slot" => m.home_slot, "away_slot" => m.away_slot, "bracket_pos" => m.bracket_pos)
        }
      end

      def show
        scope = Match.includes(:home_team, :away_team, :competition,
                               goals: :team, match_stats: :team)
        match = if params[:id].to_s.start_with?("db-")
          scope.find(params[:id].delete_prefix("db-").to_i)
        else
          scope.find_by!(external_id: params[:id])
        end
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
          if match.status == "finished" && match.competition&.code == "WC"
            Rails.cache.delete("standings_WC")
            RecalculateStandingsJob.perform_later
          end
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
