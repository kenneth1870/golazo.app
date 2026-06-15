module Api
  module V1
    # GET /api/v1/matches/:id/ai_summary?lang=es
    class AiSummariesController < BaseController
      def show
        match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                     .find_by(id: params[:id])

        return render json: { error: "not_found" }, status: :not_found unless match
        return render json: { error: "match_not_finished" }, status: :unprocessable_entity unless match.status == "finished"
        return render json: { error: "ai_unavailable" }, status: :service_unavailable unless ENV["ANTHROPIC_API_KEY"].present?

        lang      = params[:lang].to_s.split("-").first&.downcase
        lang      = %w[en es pt fr de ar ja ko].include?(lang) ? lang : "en"
        cache_key = "ai_match_summary_v3_#{match.id}_#{lang}"
        result    = Rails.cache.read(cache_key)

        result ||= AiMatchSummaryService.new(match, lang: lang).call

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
