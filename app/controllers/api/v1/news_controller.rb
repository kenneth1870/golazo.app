module Api
  module V1
    class NewsController < BaseController
      def index
        lang = params[:lang].presence_in(%w[en es pt fr de ar ja ko]) || "en"
        render json: NewsService.new.latest(limit: 30, lang: lang)
      rescue => e
        Rails.logger.error("[NewsController] #{e.message}")
        render json: []
      end

      def show
        lang = params[:lang].presence_in(%w[en es pt fr de ar ja ko]) || "en"
        article = NewsService.new.latest(limit: 30, lang: lang).find { |a| a[:id] == params[:id] }
        if article
          render json: article
        else
          render json: { error: "not found" }, status: :not_found
        end
      rescue => e
        Rails.logger.error("[NewsController] #{e.message}")
        render json: { error: "error" }, status: :internal_server_error
      end

      def content
        article = NewsService.new.latest(limit: 30).find { |a| a[:id] == params[:id] }
        return render json: { error: "not found" }, status: :not_found unless article

        body = NewsService.new.fetch_content(article[:link])
        render json: body || { paragraphs: [], hero_image: nil }
      rescue => e
        Rails.logger.error("[NewsController] content: #{e.message}")
        render json: { paragraphs: [], hero_image: nil }
      end
    end
  end
end
