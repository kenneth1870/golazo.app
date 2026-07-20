require "csv"

module Api
  module V1
    module Admin
      class DevicesController < BaseController
        before_action :require_admin!
        before_action :find_device, only: %i[destroy block push]

        # GET /api/v1/admin/devices — usage analytics for every device that has
        # opened the app, with summary stats and a per-device breakdown.
        # Supports ?q= search, ?os=, ?country=, ?push=1 filters and pagination.
        def index
          now      = Time.current
          page     = [ params[:page].to_i, 1 ].max
          per_page = params[:per].to_i
          per_page = 100 if per_page <= 0
          per_page = per_page.clamp(1, 200)

          push_ids = PushSubscription.where.not(device_id: nil).pluck(:device_id).to_set

          scope = filtered_scope(push_ids)
          matched = scope.count

          devices = scope.order(Arel.sql("last_seen_at DESC NULLS LAST"))
                         .limit(per_page).offset((page - 1) * per_page)

          summary = {
            total:          Device.count,
            active_today:   Device.where(last_seen_at: now.beginning_of_day..now).count,
            active_7d:      Device.where(last_seen_at: 7.days.ago..now).count,
            push_enabled:   push_ids.size,
            blocked:        (Device.column_names.include?("blocked_at") ? Device.where.not(blocked_at: nil).count : 0),
            total_sessions: Device.sum(:visit_count),
            avg_engaged_seconds: Device.average(:engaged_seconds).to_f.round,
            by_os:          Device.os_breakdown,
            by_locale:      Device.where.not(locale: nil).group(:locale).count,
            by_country:     Device.where.not(country: nil).group(:country).count.sort_by { |_, v| -v }.first(10).to_h
          }

          render json: {
            summary:     summary,
            devices:     devices.map { |d| d.admin_summary(push_ids) },
            pagination:  { page: page, per_page: per_page, total: matched, total_pages: (matched / per_page.to_f).ceil }
          }
        end

        # GET /api/v1/admin/devices/export — CSV of the filtered devices.
        def export
          push_ids = PushSubscription.where.not(device_id: nil).pluck(:device_id).to_set
          rows = filtered_scope(push_ids).order(Arel.sql("last_seen_at DESC NULLS LAST"))

          csv = CSV.generate do |out|
            out << %w[device_id browser os locale country city ip_address sessions engaged_seconds push_enabled blocked last_path first_seen_at last_seen_at]
            rows.each do |d|
              out << [
                d.device_id, d.browser, d.os, d.locale, d.country, d.city, d.ip_address,
                d.visit_count, d.engaged_seconds, push_ids.include?(d.device_id), d.blocked?,
                d.last_path, d.first_seen_at&.iso8601, d.last_seen_at&.iso8601
              ]
            end
          end

          send_data csv, filename: "devices-#{Date.current.iso8601}.csv", type: "text/csv"
        end

        # DELETE /api/v1/admin/devices/:id
        def destroy
          @device.destroy
          render json: { ok: true }
        end

        # POST /api/v1/admin/devices/:id/block — toggle blocked state.
        def block
          return render json: { error: "blocked_at column not yet migrated" }, status: :service_unavailable unless Device.column_names.include?("blocked_at")
          @device.update!(blocked_at: @device.blocked? ? nil : Time.current)
          push_ids = PushSubscription.where.not(device_id: nil).pluck(:device_id).to_set
          render json: @device.admin_summary(push_ids)
        end

        # POST /api/v1/admin/devices/:id/push — send a push to this one device.
        def push
          return render json: { error: "Push notifications are paused" }, status: :service_unavailable unless AppFocus.push_enabled?

          title     = params[:title].to_s.strip
          body_text = params[:body].to_s.strip
          url       = safe_url(params[:url])
          return render json: { error: "title required" }, status: :unprocessable_entity if title.blank?

          subs = PushSubscription.where(device_id: @device.device_id)
          return render json: { error: "device has no push subscription" }, status: :unprocessable_entity if subs.empty?

          sent = 0
          subs.each do |sub|
            send_web_push(sub, title:, body: body_text, url:)
            sent += 1
          rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
            sub.destroy
          rescue => e
            Rails.logger.warn "[Admin Device Push] #{e.message}"
          end

          render json: { sent: sent }
        end

        private

        def find_device
          @device = Device.find(params[:id])
        end

        # Builds the Device relation with the request's filters applied.
        def filtered_scope(push_ids)
          scope = Device.all
          scope = scope.search(params[:q])             if params[:q].present?
          scope = scope.by_os(params[:os])             if params[:os].present?
          scope = scope.by_country(params[:country])   if params[:country].present?
          scope = scope.where(device_id: push_ids.to_a) if params[:push].present?
          scope = scope.where.not(blocked_at: nil) if params[:blocked].present? && Device.column_names.include?("blocked_at")
          scope
        end

        def safe_url(raw)
          raw = raw.to_s.strip
          if raw.start_with?("/", "https://golazoapp.live", "https://www.golazoapp.live")
            raw.presence || "/"
          else
            "/"
          end
        end

        def send_web_push(sub, title:, body:, url:)
          payload = {
            title:, body:, url:,
            icon:  "/images/apple-touch-icon.png?v=2",
            badge: "/images/badge-72.png"
          }
          WebPush.payload_send(
            message:  JSON.generate(payload),
            endpoint: sub.endpoint,
            p256dh:   sub.p256dh,
            auth:     sub.auth,
            vapid: {
              subject:     ENV.fetch("VAPID_SUBJECT", "mailto:admin@golazo.app"),
              public_key:  ENV["VAPID_PUBLIC_KEY"],
              private_key: ENV["VAPID_PRIVATE_KEY"]
            }
          )
        end
      end
    end
  end
end
