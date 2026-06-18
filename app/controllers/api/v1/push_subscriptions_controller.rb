module Api
  module V1
    class PushSubscriptionsController < BaseController
      before_action :require_admin!, only: :test_push

      # POST /api/v1/push_subscriptions
      # Body: { endpoint, p256dh, auth, device_id, team_ids: [] }
      def create
        endpoint = params[:endpoint].to_s.strip
        return render json: { error: "Missing endpoint" }, status: :unprocessable_entity if endpoint.blank?
        return render json: { error: "Invalid endpoint" }, status: :unprocessable_entity unless endpoint.start_with?("https://")

        locale = params[:locale].to_s.split("-").first.downcase
        locale = "es" unless %w[es en].include?(locale)

        sub = PushSubscription.find_or_initialize_by(endpoint: endpoint)
        sub.assign_attributes(
          p256dh:       params[:p256dh].to_s,
          auth:         params[:auth].to_s,
          device_id:    params[:device_id].to_s.presence,
          team_ids:     (params[:team_ids] || []).to_json,
          locale:       locale,
          user_agent:   request.user_agent.to_s.first(500),
          last_seen_at: Time.current,
        )

        if sub.save
          render json: { ok: true, id: sub.id }, status: (sub.previously_new_record? ? :created : :ok)
        else
          render json: { error: sub.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/push_subscriptions/refresh
      # Called by the SW pushsubscriptionchange handler when Android Chrome rotates
      # the FCM token. Migrates team preferences from old → new endpoint so the
      # user keeps their notification settings without having to re-subscribe.
      def refresh
        old_endpoint = params[:old_endpoint].to_s.strip
        new_endpoint = params[:endpoint].to_s.strip

        return render json: { error: "Missing endpoint" }, status: :unprocessable_entity if new_endpoint.blank?
        return render json: { error: "Invalid endpoint" }, status: :unprocessable_entity unless new_endpoint.start_with?("https://")

        old_sub = old_endpoint.present? ? PushSubscription.find_by(endpoint: old_endpoint) : nil

        new_sub = PushSubscription.find_or_initialize_by(endpoint: new_endpoint)
        new_sub.assign_attributes(
          p256dh:       params[:p256dh].to_s,
          auth:         params[:auth].to_s,
          team_ids:     old_sub&.team_ids || "[]",
          locale:       old_sub&.locale || "es",
          device_id:    old_sub&.device_id || params[:device_id].to_s.presence,
          user_agent:   request.user_agent.to_s.first(500),
          last_seen_at: Time.current,
        )

        if new_sub.save
          old_sub.destroy if old_sub && old_endpoint != new_endpoint
          render json: { ok: true }
        else
          render json: { error: new_sub.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/push_subscriptions/:id/teams
      # Updates the team_ids list for a subscription
      def update_teams
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        return render json: { error: "Not found" }, status: :not_found unless sub

        sub.update!(team_ids: (params[:team_ids] || []).to_json, last_seen_at: Time.current)
        render json: { ok: true, team_ids: sub.team_names }
      end

      # DELETE /api/v1/push_subscriptions
      # Body: { endpoint }
      def destroy
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        sub&.destroy
        render json: { ok: true }
      end

      # GET /api/v1/vapid_public_key — returns the public key so the frontend can subscribe
      def vapid_key
        render json: { key: ENV["VAPID_PUBLIC_KEY"].to_s }
      end

      # POST /api/v1/push_test — sends a test push to all stored subscriptions
      # Use from the Rails console or curl to verify push delivery in production.
      def test_push
        vapid_configured = ENV["VAPID_PUBLIC_KEY"].present? &&
                           ENV["VAPID_PRIVATE_KEY"].present? &&
                           ENV["VAPID_SUBJECT"].present?

        unless vapid_configured
          return render json: {
            error: "VAPID keys not configured",
            missing: [
              ENV["VAPID_PUBLIC_KEY"].blank?   ? "VAPID_PUBLIC_KEY"   : nil,
              ENV["VAPID_PRIVATE_KEY"].blank?  ? "VAPID_PRIVATE_KEY"  : nil,
              ENV["VAPID_SUBJECT"].blank?       ? "VAPID_SUBJECT"      : nil
            ].compact
          }, status: :unprocessable_entity
        end

        subs = PushSubscription.all
        return render json: { error: "No subscriptions found" }, status: :unprocessable_entity if subs.empty?

        sent   = 0
        failed = []

        subs.each do |sub|
          payload = {
            title:    "🔔 Golazo Test",
            body:     "Push notifications are working! ✅",
            url:      "/",
            icon:     "/images/apple-touch-icon.png?v=2",
            badge:    "/images/badge-72.png"
          }.to_json

          WebPush.payload_send(
            message:  payload,
            endpoint: sub.endpoint,
            p256dh:   sub.p256dh,
            auth:     sub.auth,
            vapid: {
              subject:     ENV["VAPID_SUBJECT"],
              public_key:  ENV["VAPID_PUBLIC_KEY"],
              private_key: ENV["VAPID_PRIVATE_KEY"]
            },
            ttl: 60
          )
          sent += 1
        rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
          failed << { id: sub.id, error: "stale: #{e.message}" }
          sub.destroy
        rescue => e
          failed << { id: sub.id, error: "#{e.class}: #{e.message}" }
        end

        render json: { sent: sent, total: subs.size, failed: failed, vapid_subject: ENV["VAPID_SUBJECT"] }
      end
    end
  end
end
