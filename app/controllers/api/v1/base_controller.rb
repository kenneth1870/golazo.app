module Api
  module V1
    class BaseController < ApplicationController
      protect_from_forgery with: :null_session
      before_action :set_default_format

      private

      def set_default_format
        request.format = :json
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
