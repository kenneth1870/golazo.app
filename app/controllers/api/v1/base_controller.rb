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

      # Tiered HTTP cache so CDN/browser caching actually kicks in.
      # Live and today endpoints get short TTLs; static reference data gets longer.
      def set_cache_headers
        return unless response.ok?
        return if request.path.include?("/search") || request.path.include?("/predictions") || request.path.include?("/locale")
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

      # Guards write endpoints (score/goal/stat mutations). Requires
      # `Authorization: Bearer <ADMIN_API_TOKEN>`. Fails closed: if
      # ADMIN_API_TOKEN is unset, every request is rejected, so these endpoints
      # are never anonymously writable in any environment.
      def require_admin!
        configured = ENV["ADMIN_API_TOKEN"].to_s
        provided   = request.authorization.to_s.sub(/\ABearer\s+/i, "")

        return if configured.present? && provided.present? &&
                  ActiveSupport::SecurityUtils.secure_compare(provided, configured)

        render json: { error: "unauthorized" }, status: :unauthorized
      end
    end
  end
end
