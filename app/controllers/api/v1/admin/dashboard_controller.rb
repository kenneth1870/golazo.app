module Api
  module V1
    module Admin
      class DashboardController < BaseController
        before_action :require_admin!

        def index
          render json: {
            users:            User.count,
            admins:           User.where(role: "admin").count,
            push_subscribers: PushSubscription.count,
            live_matches:     Match.where(status: "live").count,
            total_matches:    Match.count,
            predictions:      ScorePrediction.count,
            news_articles:    0,
            recent_users:     User.order(created_at: :desc).limit(5).map(&:as_json_public),
          }
        end
      end
    end
  end
end
