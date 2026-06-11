module Api
  module V1
    module Admin
      class NewsController < BaseController
        before_action :require_admin!

        # GET /api/v1/admin/news — latest articles from the news service
        def index
          articles = NewsService.new.latest(limit: 100, lang: "en")
          render json: articles
        rescue => e
          Rails.logger.error("[Admin::NewsController] #{e.message}")
          render json: []
        end
      end
    end
  end
end
