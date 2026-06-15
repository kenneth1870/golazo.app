module Api
  module V1
    class TrackingController < BaseController
      # POST /api/v1/track — lightweight analytics heartbeat from the client.
      # Body: { device_id, path, locale }. No auth; best-effort, never errors.
      def ping
        device_id = params[:device_id].to_s.strip
        # Ignore more than one heartbeat per 30s from the same device to prevent
        # visit_count inflation from runaway or malicious clients.
        throttle_key = "track_#{Digest::SHA1.hexdigest(device_id)[0, 12]}"
        return head :no_content if Rails.cache.read(throttle_key)
        Rails.cache.write(throttle_key, 1, expires_in: 30.seconds)

        Device.track!(
          device_id:  device_id,
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
