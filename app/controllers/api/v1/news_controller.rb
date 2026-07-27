module Api
  module V1
    class NewsController < BaseController
      def index
        lang     = normalize_lang(params[:lang])
        keywords = extract_keywords(params[:q])
        service  = NewsService.new
        codes    = nil
        if AppFocus.clubs_primary? && params[:leagues].present?
          codes = params[:leagues].to_s.split(",").map(&:strip).reject(&:blank?).first(5)
        end
        pool_limit = keywords.any? ? 120 : 60
        articles = service.latest(limit: pool_limit, lang: lang, league_codes: codes)
        if keywords.any?
          articles = articles.select { |a|
            text = "#{a[:title]} #{a[:summary]}".downcase
            keywords.any? { |k| text.include?(k) }
          }
          result_limit = params[:limit].to_i
          result_limit = 4 if result_limit <= 0
          result_limit = [ result_limit, 40 ].min
          articles = articles.first(result_limit)
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

      def related
        lang = normalize_lang(params[:lang])
        limit = [ params[:limit].to_i, 8 ].min
        limit = 4 if limit <= 0
        articles = NewsService.new.related_articles(id: params[:id], lang: lang, limit: limit)
        expires_in 10.minutes, public: true
        render json: articles
      rescue => e
        Rails.logger.error("[NewsController] related: #{e.message}")
        render json: []
      end

      def content
        lang    = normalize_lang(params[:lang])
        service = NewsService.new
        article = service.find_article(id: params[:id], lang: lang)
        return render json: { error: "not found" }, status: :not_found unless article

        body = service.fetch_content(article[:link]) || {}

        hero_image = body[:hero_image].presence || article[:image]
        paragraphs = body[:paragraphs].presence || (article[:summary].present? ? [ article[:summary] ] : [])
        images     = body[:images].presence || []
        reading_time_min = body[:reading_time_min] || service.reading_time_for(paragraphs)

        if body[:hero_image].present? && body[:hero_image] != article[:image] && article[:id].present?
          Rails.cache.write(
            "news_article_#{lang}_#{article[:id]}",
            article.merge(image: body[:hero_image]),
            expires_in: 24.hours
          )
        end

        render json: {
          hero_image: hero_image,
          paragraphs: paragraphs,
          images: images,
          is_video: article[:is_video] == true,
          reading_time_min: reading_time_min
        }
      rescue => e
        Rails.logger.error("[NewsController] content: #{e.message}")
        render json: { paragraphs: [], hero_image: nil, images: [], is_video: false, reading_time_min: 1 }
      end

      private

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
