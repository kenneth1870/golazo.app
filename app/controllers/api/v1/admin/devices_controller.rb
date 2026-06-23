module Api
  module V1
    module Admin
      class DevicesController < BaseController
        before_action :require_admin!

        # GET /api/v1/admin/devices — usage analytics for every device that has
        # opened the app, with summary stats and a per-device breakdown.
        def index
          now      = Time.current
          page     = [ params[:page].to_i, 1 ].max
          per_page = [ [ params[:per].to_i, 1 ].max, 200 ].min
          per_page = 100 if per_page.zero?
          push_ids = PushSubscription.where.not(device_id: nil).pluck(:device_id).to_set

          devices = Device.order(Arel.sql("last_seen_at DESC NULLS LAST"))
                          .limit(per_page).offset((page - 1) * per_page)

          summary = {
            total:          Device.count,
            active_today:   Device.where(last_seen_at: now.beginning_of_day..now).count,
            active_7d:      Device.where(last_seen_at: 7.days.ago..now).count,
            push_enabled:   push_ids.size,
            total_sessions: Device.sum(:visit_count),
            avg_engaged_seconds: Device.average(:engaged_seconds).to_f.round,
            by_os:          Device.os_breakdown,
            by_locale:      Device.where.not(locale: nil).group(:locale).count,
            by_country:     Device.where.not(country: nil).group(:country).count.sort_by { |_, v| -v }.first(10).to_h
          }

          total       = summary[:total]
          total_pages = (total / per_page.to_f).ceil

          render json: {
            summary:     summary,
            devices:     devices.map { |d| d.admin_summary(push_ids) },
            pagination:  { page: page, per_page: per_page, total: total, total_pages: total_pages }
          }
        end
      end
    end
  end
end
