module Api
  module V1
    module Admin
      class DashboardController < BaseController
        before_action :require_admin!

        def index
          now = Time.current

          render json: {
            users:            User.count,
            admins:           User.where(role: "admin").count,
            push_subscribers: PushSubscription.count,
            live_matches:     Match.where(status: "live").count,
            total_matches:    Match.count,
            predictions:      ScorePrediction.count,
            news_articles:    0,
            recent_users:     User.order(created_at: :desc).limit(5).map(&:as_json_public),

            # ── Usage analytics ──────────────────────────────
            devices: {
              total:               Device.count,
              active_today:        Device.where(last_seen_at: now.beginning_of_day..now).count,
              active_7d:           Device.where(last_seen_at: 7.days.ago..now).count,
              total_sessions:      Device.sum(:visit_count),
              avg_engaged_seconds: Device.average(:engaged_seconds).to_f.round,
              new_per_day:         new_devices_series(14),
              top_screens:         top_screens(8)
            }
          }
        end

        private

        # [{ date: "2026-06-24", count: 3 }, …] of new devices/day for the last
        # `days` days, with missing days zero-filled and ordered oldest → newest.
        def new_devices_series(days)
          counts = Device.where(first_seen_at: days.days.ago.beginning_of_day..Time.current)
                         .group(Arel.sql("DATE(first_seen_at)"))
                         .count
                         .transform_keys { |k| k.is_a?(String) ? Date.parse(k) : k.to_date }

          (0...days).to_a.reverse.map do |n|
            d = Date.current - n
            { date: d.iso8601, count: counts[d] || 0 }
          end
        end

        # Most-visited screens by each device's last_path.
        def top_screens(limit)
          Device.where.not(last_path: [ nil, "" ])
                .group(:last_path)
                .order(Arel.sql("COUNT(*) DESC"))
                .limit(limit)
                .count
                .map { |path, count| { path: path, count: count } }
        end
      end
    end
  end
end
