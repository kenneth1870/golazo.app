module Api
  module V1
    # GET  /api/v1/matches/:match_id/reactions      → { "⚽" => 12, ... }
    # POST /api/v1/matches/:match_id/reactions      → { emoji: "⚽" } → updated counts
    class MatchReactionsController < BaseController
      CACHE_TTL = 30.seconds

      def show
        counts = cached_counts(params[:match_id])
        render json: counts
      end

      def create
        emoji    = params[:emoji].to_s.strip
        match_id = params[:match_id].to_s

        unless MatchReaction::ALLOWED.include?(emoji)
          return render json: { error: "invalid emoji" }, status: :unprocessable_entity
        end

        # Rate-limit per IP: max 1 reaction per emoji per match per 5 minutes
        rl_key = "reaction_rl_#{request.remote_ip}_#{match_id}_#{emoji}"
        if Rails.cache.exist?(rl_key)
          # Still return current counts so UI stays in sync
          return render json: cached_counts(match_id)
        end

        MatchReaction.react!(match_id, emoji)
        Rails.cache.write(rl_key, 1, expires_in: 5.minutes)

        # Bust the counts cache so next read returns fresh data
        Rails.cache.delete("match_reactions_#{match_id}")
        render json: cached_counts(match_id)
      rescue => e
        Rails.logger.error("[MatchReactionsController] #{e.message}")
        render json: {}, status: :internal_server_error
      end

      private

      def cached_counts(match_id)
        Rails.cache.fetch("match_reactions_#{match_id}", expires_in: CACHE_TTL) do
          MatchReaction.counts_for(match_id)
        end
      end
    end
  end
end
