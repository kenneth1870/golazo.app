module Api
  module V1
    # GET /api/v1/matches/:id/ai_summary
    class AiSummariesController < BaseController
      def show
        match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                     .find_by(id: params[:match_id])

        unless match
          return render json: { error: "not_found" }, status: :not_found
        end

        unless match.status == "finished"
          return render json: { error: "match_not_finished" }, status: :unprocessable_entity
        end

        unless ENV["ANTHROPIC_API_KEY"].present?
          return render json: { error: "ai_unavailable" }, status: :service_unavailable
        end

        # Kick off a background job to pre-warm cache on first request
        # but also try to serve synchronously (it's fast with haiku)
        result = Rails.cache.read("ai_match_summary_v2_#{match.id}")

        if result.nil?
          result = AiMatchSummaryService.new(match).call
        end

        if result
          render json: result
        else
          render json: { error: "generation_failed" }, status: :service_unavailable
        end
      rescue => e
        Rails.logger.error("[AiSummariesController] #{e.message}")
        render json: { error: "server_error" }, status: :internal_server_error
      end
    end
  end
end
