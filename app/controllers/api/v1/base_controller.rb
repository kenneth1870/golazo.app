module Api
  module V1
    class BaseController < ApplicationController
      protect_from_forgery with: :null_session
      before_action :set_default_format
      after_action  :set_cache_headers

      private

      def set_default_format
        request.format = :json
      end

      # ── JWT authentication ──────────────────────────────
      def current_user
        return @current_user if defined?(@current_user)
        token = extract_bearer_token
        @current_user = token ? User.from_token(token) : nil
      end

      def require_user!
        render json: { error: "unauthorized" }, status: :unauthorized unless current_user
      end

      def require_admin!
        # Legacy ENV token (still works for data-sync scripts)
        env_token = ENV["ADMIN_API_TOKEN"].to_s
        provided  = request.authorization.to_s.sub(/\ABearer\s+/i, "")

        return if env_token.present? && provided.present? &&
                  ActiveSupport::SecurityUtils.secure_compare(provided, env_token)

        # JWT-based admin check
        return if current_user&.admin?

        render json: { error: "unauthorized" }, status: :unauthorized
      end

      def extract_bearer_token
        auth = request.authorization.to_s
        return nil unless auth.start_with?("Bearer ")
        auth.sub("Bearer ", "").strip
      end

      # ── HTTP cache headers ──────────────────────────────
      def set_cache_headers
        return unless response.ok?
        return unless request.get? || request.head?
        return if Rails.env.development?
        return if request.path.include?("/search") ||
                  request.path.include?("/predictions") ||
                  request.path.include?("/locale") ||
                  request.path.include?("/admin")
        ttl = case request.path
        when %r{/today|/live_scores|/match_detail}  then 30.seconds
        when %r{/matches|/fixtures|/results}        then 2.minutes
        when %r{/standings|/groups}                 then 5.minutes
        when %r{/news}                              then 10.minutes
        when %r{/venues|/top_scorers|/competitions} then 15.minutes
        else                                             1.minute
        end
        response.set_header("Cache-Control", "public, max-age=#{ttl.to_i}, stale-while-revalidate=#{(ttl * 2).to_i}")
      end
    end
  end
end
