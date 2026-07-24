module Api
  module V1
    class PushSubscriptionsController < BaseController
      before_action :require_admin!, only: :test_push

      # POST /api/v1/push_subscriptions
      # Body: { endpoint, p256dh, auth, device_id, team_ids: [], competition_codes: [] }
      def create
        return render json: { error: "Push notifications are paused" }, status: :service_unavailable unless AppFocus.push_enabled?

        endpoint = params[:endpoint].to_s.strip
        return render json: { error: "Missing endpoint" }, status: :unprocessable_entity if endpoint.blank?
        return render json: { error: "Invalid endpoint" }, status: :unprocessable_entity unless valid_push_endpoint?(endpoint)

        locale = params[:locale].to_s.split("-").first.downcase
        locale = "es" unless %w[es en].include?(locale)

        sub = PushSubscription.find_or_initialize_by(endpoint: endpoint)
        sub.assign_attributes(
          p256dh:       params[:p256dh].to_s,
          auth:         params[:auth].to_s,
          device_id:    params[:device_id].to_s.presence,
          team_ids:     sanitize_team_ids(params[:team_ids]),
          **scope_attrs(params),
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
      def refresh
        return render json: { error: "Push notifications are paused" }, status: :service_unavailable unless AppFocus.push_enabled?

        old_endpoint = params[:old_endpoint].to_s.strip
        new_endpoint = params[:endpoint].to_s.strip

        return render json: { error: "Missing endpoint" }, status: :unprocessable_entity if new_endpoint.blank?
        return render json: { error: "Invalid endpoint" }, status: :unprocessable_entity unless valid_push_endpoint?(new_endpoint)

        old_sub = old_endpoint.present? ? PushSubscription.find_by(endpoint: old_endpoint) : nil

        new_sub = PushSubscription.find_or_initialize_by(endpoint: new_endpoint)
        new_sub.assign_attributes(
          p256dh:       params[:p256dh].to_s,
          auth:         params[:auth].to_s,
          team_ids:     old_sub&.team_ids || "[]",
          **(old_sub ? scope_attrs_from_sub(old_sub) : scope_attrs(params)),
          locale:       old_sub&.locale || "es",
          device_id:    old_sub&.device_id || params[:device_id].to_s.presence,
          user_agent:   request.user_agent.to_s.first(500),
          last_seen_at: Time.current,
        )
        if PushSubscription.column_names.include?("event_prefs")
          new_sub.event_prefs = old_sub&.event_prefs || sanitize_event_prefs(params[:event_prefs])
        end

        if new_sub.save
          old_sub.destroy if old_sub && old_endpoint != new_endpoint
          render json: { ok: true }
        else
          render json: { error: new_sub.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/push_subscriptions/teams
      def update_teams
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        return render json: { error: "Not found" }, status: :not_found unless sub

        attrs = {
          team_ids: sanitize_team_ids(params[:team_ids]),
          last_seen_at: Time.current,
          **scope_attrs(params)
        }
        if params.key?(:event_prefs) && PushSubscription.column_names.include?("event_prefs")
          attrs[:event_prefs] = sanitize_event_prefs(params[:event_prefs])
        end
        sub.update!(attrs)
        render json: {
          ok: true,
          team_ids: sub.team_names,
          competition_codes: sub.competition_codes_list,
          event_prefs: sub.event_prefs_list
        }
      end

      # DELETE /api/v1/push_subscriptions
      def destroy
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        sub&.destroy
        render json: { ok: true }
      end

      # GET /api/v1/vapid_public_key
      def vapid_key
        return render json: { key: nil, enabled: false } unless AppFocus.push_enabled?

        render json: { key: ENV["VAPID_PUBLIC_KEY"].to_s, enabled: true }
      end

      # POST /api/v1/push_test
      def test_push
        return render json: { error: "Push notifications are paused" }, status: :service_unavailable unless AppFocus.push_enabled?

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

      private

      ALLOWED_PUSH_HOSTS = %w[
        fcm.googleapis.com
        updates.push.services.mozilla.com
        notify.windows.com
        web.push.apple.com
        push.apple.com
      ].freeze

      def sanitize_team_ids(raw)
        Array(raw).map(&:to_s).reject(&:blank?).uniq.to_json
      end

      def sanitize_competition_codes(raw)
        return "[]" unless PushSubscription.column_names.include?("competition_codes")
        Array(raw).map { |c| c.to_s.upcase }.reject(&:blank?).uniq.to_json
      end

      def scope_attrs(params)
        return {} unless PushSubscription.column_names.include?("competition_codes")
        { competition_codes: sanitize_competition_codes(params[:competition_codes]) }
      end

      def scope_attrs_from_sub(sub)
        return {} unless PushSubscription.column_names.include?("competition_codes")
        { competition_codes: sub.competition_codes }
      end

      def sanitize_event_prefs(raw)
        return "[]" if raw.nil?
        allowed = PushSubscription::VALID_EVENT_TYPES
        (Array(raw).map(&:to_s) & allowed).to_json
      end

      def valid_push_endpoint?(endpoint)
        uri = URI.parse(endpoint)
        uri.scheme == "https" && ALLOWED_PUSH_HOSTS.any? { |h| uri.host == h || uri.host&.end_with?(".#{h}") }
      rescue URI::InvalidURIError
        false
      end
    end
  end
end
