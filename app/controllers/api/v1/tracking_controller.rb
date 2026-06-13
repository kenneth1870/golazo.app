module Api
  module V1
    class TrackingController < BaseController
      # POST /api/v1/track — lightweight analytics heartbeat from the client.
      # Body: { device_id, path, locale }. No auth; best-effort, never errors.
      def ping
        Device.track!(
          device_id:  params[:device_id],
          user_agent: request.user_agent,
          locale:     params[:locale],
          path:       params[:path]
        )
        head :no_content
      rescue => e
        Rails.logger.warn("[Tracking] #{e.class}: #{e.message}")
        head :no_content
      end
    end
  end
end
