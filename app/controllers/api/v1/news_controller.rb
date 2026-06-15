module Api
  module V1
    class NewsController < BaseController
      def index
        lang     = normalize_lang(params[:lang])
        keywords = extract_keywords(params[:q])
        articles = NewsService.new.latest(limit: 60, lang: lang)
        if keywords.any?
          articles = articles.select { |a|
            text = "#{a[:title]} #{a[:summary]}".downcase
            keywords.any? { |k| text.include?(k) }
          }.first(4)
          expires_in 5.minutes, public: true
        else
          expires_in 3.minutes, public: true
        end
        render json: articles
      rescue => e
        Rails.logger.error("[NewsController] #{e.message}")
        render json: []
      end

      def show
        lang    = normalize_lang(params[:lang])
        article = NewsService.new.find_article(id: params[:id], lang: lang)
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
        article = NewsService.new.find_article(id: params[:id], lang: lang)
        return render json: { error: "not found" }, status: :not_found unless article

        body = NewsService.new.fetch_content(article[:link]) || {}

        # Merge feed-level data as fallbacks so ESPN articles always have
        # something to show even when the content API returns no paragraphs.
        hero_image = body[:hero_image].presence || article[:image]
        paragraphs = body[:paragraphs].presence || (article[:summary].present? ? [ article[:summary] ] : [])

        render json: { hero_image: hero_image, paragraphs: paragraphs }
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

      def extract_keywords(raw)
        return [] if raw.blank?
        raw.to_s.downcase.split(/[\s,]+/).map(&:strip).select { |k| k.length > 3 }.first(10)
      end
    end
  end
end
