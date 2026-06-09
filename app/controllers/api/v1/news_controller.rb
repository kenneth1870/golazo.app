module Api
  module V1
    class NewsController < BaseController
      def index
        lang = normalize_lang(params[:lang])
        render json: NewsService.new.latest(limit: 60, lang: lang)
      rescue => e
        Rails.logger.error("[NewsController] #{e.message}")
        render json: []
      end

      def show
        lang = normalize_lang(params[:lang])
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
        lang    = normalize_lang(params[:lang])
        article = NewsService.new.latest(limit: 30, lang: lang).find { |a| a[:id] == params[:id] }
        return render json: { error: "not found" }, status: :not_found unless article

        body = NewsService.new.fetch_content(article[:link])
        render json: body || { paragraphs: [], hero_image: nil }
      rescue => e
        Rails.logger.error("[NewsController] content: #{e.message}")
        render json: { paragraphs: [], hero_image: nil }
      end
      private

      # Strips region suffix ("es-MX" → "es") and validates against supported locales
      def normalize_lang(raw)
        code = raw.to_s.split("-").first&.downcase
        code.presence_in(%w[en es pt fr de ar ja ko]) || "en"
      end
    end
  end
end
