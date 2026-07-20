module Api
  module V1
    module Admin
      class PushController < BaseController
        before_action :require_admin!

        # GET /api/v1/admin/push — stats
        def index
          render json: {
            total:      PushSubscription.count,
            with_teams: PushSubscription.where("team_ids != '[]' AND team_ids IS NOT NULL AND team_ids != 'null'").count,
            global:     PushSubscription.where("team_ids IS NULL OR team_ids = '[]' OR team_ids = 'null'").count
          }
        end

        # GET /api/v1/admin/push/devices — list subscribed devices for the admin table
        def devices
          subs = PushSubscription.order(Arel.sql("COALESCE(last_seen_at, updated_at) DESC")).limit(200)
          render json: subs.map(&:admin_summary)
        end

        # POST /api/v1/admin/push/broadcast — send to all or filter by team name
        def broadcast
          return render json: { error: "Push notifications are paused" }, status: :service_unavailable unless AppFocus.push_enabled?

          title     = params[:title].to_s.strip
          body_text = params[:body].to_s.strip
          raw_url   = params[:url].to_s.strip
          url       = if raw_url.start_with?("/") ||
                         raw_url.start_with?("https://golazoapp.live") ||
                         raw_url.start_with?("https://www.golazoapp.live")
                        raw_url.presence || "/"
          else
                        "/"
          end
          team_name = params[:team_name].to_s.strip.presence

          return render json: { error: "title required" }, status: :unprocessable_entity if title.blank?
          return render json: { error: "title too long" }, status: :unprocessable_entity if title.length > 100
          return render json: { error: "body too long" }, status: :unprocessable_entity if body_text.length > 500

          subscriptions = team_name.present? ? PushSubscription.for_teams([ team_name ]) : PushSubscription.all

          sent  = 0
          failed = 0

          subscriptions.find_each do |sub|
            payload = {
              title:  title,
              body:   body_text,
              url:    url,
              icon:   "/images/apple-touch-icon.png?v=2",
              badge:  "/images/badge-72.png"
            }
            WebPush.payload_send(
              message:    JSON.generate(payload),
              endpoint:   sub.endpoint,
              p256dh:     sub.p256dh,
              auth:       sub.auth,
              vapid: {
                subject:     ENV.fetch("VAPID_SUBJECT", "mailto:admin@golazo.app"),
                public_key:  ENV["VAPID_PUBLIC_KEY"],
                private_key: ENV["VAPID_PRIVATE_KEY"]
              }
            )
            sent += 1
          rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
            sub.destroy
            failed += 1
          rescue => e
            Rails.logger.warn "[Admin Push] #{e.message}"
            failed += 1
          end

          render json: { sent:, failed: }
        end
      end
    end
  end
end
