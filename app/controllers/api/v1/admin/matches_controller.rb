module Api
  module V1
    module Admin
      class MatchesController < BaseController
        before_action :require_admin!
        before_action :find_match, only: %i[show update]

        def index
          scope = Match.includes(:home_team, :away_team)
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where("kickoff_at >= ?", Date.today) if params[:upcoming] == "1"
          scope = scope.order(kickoff_at: :desc).limit(100)
          render json: scope.map { |m| match_json(m) }
        end

        def show
          render json: match_json(@match)
        end

        def update
          if @match.update(match_params)
            render json: match_json(@match)
          else
            render json: { errors: @match.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # Enqueues a full data heal: busts all date caches, re-fetches every WC
        # match from the API bypassing the flap guard, fixes scores/statuses,
        # and recalculates standings. Safe to trigger at any time.
        def heal
          ResyncAllWcMatchesJob.perform_later
          render json: { ok: true, message: "Heal job enqueued — check logs for progress" }
        end

        private

        def find_match
          @match = Match.find(params[:id])
        end

        def match_params
          params.permit(:status, :home_score, :away_score, :kickoff_at, :venue, :round, :group_stage)
        end

        def match_json(m)
          {
            id:          m.id,
            external_id: m.external_id,
            status:      m.status,
            kickoff_at:  m.kickoff_at,
            home_score:  m.home_score,
            away_score:  m.away_score,
            round:       m.round,
            group_stage: m.group_stage,
            home_slot:   m.home_slot,
            away_slot:   m.away_slot,
            home_team:   { id: m.home_team&.id, name: m.home_team&.name, flag_url: m.home_team&.flag_url },
            away_team:   { id: m.away_team&.id, name: m.away_team&.name, flag_url: m.away_team&.flag_url }
          }
        end
      end
    end
  end
end
