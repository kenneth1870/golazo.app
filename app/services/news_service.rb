class NewsService
  # ESPN's public JSON API endpoints (no auth required, full images returned).
  # Used instead of their RSS feeds because the RSS items carry no images and
  # their article pages block server-side scraping via AWS WAF.
  ESPN_API_ENDPOINTS = {
    "es" => [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=25&lang=es",
      "https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=25&lang=es",
    ],
    "en" => [
      "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=25",
      "https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=25",
    ],
  }.freeze

  # Primary feeds per locale. Falls back to English when a locale has no feeds.
  # ESPN sources are now fetched via the JSON API (see ESPN_API_ENDPOINTS) so
  # they are intentionally absent from this RSS feed list.
  FEEDS = {
    "en" => [
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"  },
      { url: "https://www.goal.com/feeds/en/news",                             source: "Goal.com"   }
    ],
    "es" => [
      { url: "https://e00-marca.uecdn.es/rss/futbol.xml",                      source: "Marca"      }
    ],
    "pt" => [
      { url: "https://www.goal.com/feeds/pt/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       }
    ],
    "fr" => [
      { url: "https://www.goal.com/feeds/fr/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       }
    ],
    "de" => [
      { url: "https://www.goal.com/feeds/de/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       }
    ],
    "ar" => [
      { url: "https://www.goal.com/feeds/ar/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/arabic/sports/rss.xml",                source: "BBC Arabic"      }
    ],
    "ja" => [
      { url: "https://www.goal.com/feeds/ja/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       }
    ],
    "ko" => [
      { url: "https://www.goal.com/feeds/ko/news",                             source: "Goal.com"        },
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       }
    ]
  }.freeze

  USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".freeze

  # Only fetch article content from known publisher domains.
  # Prevents a compromised RSS feed from making the server issue requests to
  # internal metadata endpoints or arbitrary hosts.
  ALLOWED_CONTENT_DOMAINS = %w[
    www.bbc.com
    www.bbc.co.uk
    feeds.bbci.co.uk
    www.espn.com
    espndeportes.espn.com
    www.goal.com
    e00-marca.uecdn.es
    www.marca.com
    www.theguardian.com
    www.skysports.com
    www.uefa.com
    www.fifa.com
  ].freeze

  def latest(limit: 20, lang: "en")
    feeds = FEEDS[lang] || FEEDS["en"]
    Rails.cache.fetch("news_feed_v4_#{lang}", expires_in: 30.minutes) do
      # RSS feeds (BBC, Marca, Goal.com, etc.)
      rss_threads  = feeds.map { |feed| Thread.new { fetch_feed(feed[:url], feed[:source]) } }
      # ESPN JSON API feeds (images + descriptions, no WAF issues)
      espn_lang    = %w[en es].include?(lang) ? lang : "en"
      espn_threads = (ESPN_API_ENDPOINTS[espn_lang] || []).map { |url| Thread.new { fetch_espn_api(url, lang: espn_lang) } }

      items = (rss_threads + espn_threads).flat_map { |t| t.join(8)&.value || [] }
      items.uniq { |a| a[:link] }
           .sort_by { |a| a[:published_at] || Time.at(0) }.reverse
           .first(limit)
    end
  end

  # Fetches and parses the full article body from the original URL.
  # Returns { paragraphs: [...], hero_image: url }
  #
  # ESPN article pages are protected by AWS WAF and cannot be scraped
  # server-side. For those URLs we fall back to the ESPN JSON API which
  # returns description text + a proper CDN image without any auth requirement.
  def fetch_content(url)
    return nil if url.blank?

    begin
      host = URI.parse(url).host.to_s.downcase.sub(/\Awww\./, "")
      # Normalise: compare bare domain and www. variant against the allowlist
      allowed = ALLOWED_CONTENT_DOMAINS.any? do |d|
        bare = d.sub(/\Awww\./, "")
        host == bare || host == "www.#{bare}"
      end
      unless allowed
        Rails.logger.warn("[NewsService] Blocked fetch to disallowed host: #{host} (#{url})")
        return nil
      end
    rescue URI::InvalidURIError
      return nil
    end

    # ESPN articles: use the public JSON API instead of scraping (WAF blocks curl)
    if url =~ %r{espn(?:deportes)?\.espn\.com/.*/nota/_/id/(\d+)/}
      return fetch_espn_article_content($1, url)
    end

    Rails.cache.fetch("news_content_#{Digest::SHA1.hexdigest(url)}", expires_in: 60.minutes) do
      response = Faraday.get(url) do |req|
        req.options.timeout      = 8
        req.options.open_timeout = 5
        req.headers["User-Agent"] = USER_AGENT
        req.headers["Accept"]     = "text/html"
      end

      doc = Nokogiri::HTML(response.body)

      # Hero image — prefer largest available from <figure> or <meta og:image>
      hero_img = extract_hero_image(doc)

      # Paragraphs — try progressively broader selectors
      paragraphs = extract_paragraphs(doc)

      { paragraphs: paragraphs, hero_image: hero_img }
    end
  rescue => e
    Rails.logger.warn("[NewsService] fetch_content failed for #{url}: #{e.message}")
    nil
  end

  private

  # ── ESPN JSON API helpers ────────────────────────────────────────────────────

  # Fetches articles from one of ESPN's public site API endpoints.
  # Normalises each article into the same shape used by the RSS parser so both
  # sources can be merged transparently in #latest.
  # Also side-caches each article at "espn_article_<id>" so fetch_content can
  # retrieve image + description without making a second network call.
  def fetch_espn_api(url, lang: "en")
    response = Faraday.get(url) do |req|
      req.options.timeout      = 6
      req.options.open_timeout = 4
      req.headers["User-Agent"] = "GolazoApp/1.0"
      req.headers["Accept"]     = "application/json"
    end

    data     = JSON.parse(response.body)
    articles = data["articles"] || []
    source   = lang == "es" ? "ESPN Deportes" : "ESPN FC"

    articles.filter_map do |a|
      link = a.dig("links", "web", "href").to_s
      # Skip video clips; only keep article URLs (/nota/)
      next unless link.include?("/nota/")

      img = a.dig("images", 0, "url")
      # Prefer the full-size header image (1296×729 pattern) over thumbnails
      header_img = a["images"]&.find { |i| i["type"] == "header" }&.dig("url")
      img = header_img || img

      pub_str   = a["published"]
      published = pub_str ? Time.parse(pub_str) : nil
      espn_id   = link.match(%r{/_/id/(\d+)/})&.[](1)
      id        = Digest::SHA1.hexdigest(link)[0, 12]

      item = {
        id:           id,
        title:        a["headline"].to_s.strip,
        link:         link,
        summary:      a["description"].to_s.strip,
        source:       source,
        image:        img,
        published_at: published,
        date_label:   published ? published.strftime("%-d %b %Y") : nil,
      }

      # Side-cache so fetch_espn_article_content can look up by ESPN numeric ID
      if espn_id
        Rails.cache.write("espn_article_#{espn_id}", item, expires_in: 60.minutes)
      end

      item
    rescue => e
      Rails.logger.warn("[NewsService] ESPN API parse error: #{e.message}")
      nil
    end
  rescue => e
    Rails.logger.warn("[NewsService] ESPN API #{url} failed: #{e.message}")
    []
  end

  # Returns { paragraphs: [...], hero_image: url } for an ESPN article using
  # its numeric ID. Tries the side-cache populated by fetch_espn_api first,
  # then falls back to a direct API lookup on the FIFA World Cup endpoint.
  def fetch_espn_article_content(espn_id, original_url = nil)
    Rails.cache.fetch("espn_content_#{espn_id}", expires_in: 60.minutes) do
      # 1. Try the side-cache written during feed fetch
      cached = Rails.cache.read("espn_article_#{espn_id}")
      if cached
        next { hero_image: cached[:image], paragraphs: [ cached[:summary] ].reject(&:blank?) }
      end

      # 2. Fall back to a direct API call for both locales
      found = nil
      [ "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=50&lang=es",
        "https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=50&lang=es",
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=50",
      ].each do |api_url|
        response = Faraday.get(api_url) do |req|
          req.options.timeout = 6
          req.headers["User-Agent"] = "GolazoApp/1.0"
        end
        articles = JSON.parse(response.body)["articles"] || []
        found = articles.find { |a| a.dig("links", "web", "href").to_s.include?("/_/id/#{espn_id}/") }
        break if found
      rescue
        next
      end

      if found
        img  = found["images"]&.find { |i| i["type"] == "header" }&.dig("url") ||
               found.dig("images", 0, "url")
        desc = found["description"].to_s.strip
        { hero_image: img, paragraphs: [ desc ].reject(&:blank?) }
      else
        # Nothing found — return empty so UI can show the summary text
        Rails.logger.warn("[NewsService] ESPN article #{espn_id} not found via API")
        { hero_image: nil, paragraphs: [] }
      end
    end
  rescue => e
    Rails.logger.warn("[NewsService] fetch_espn_article_content #{espn_id}: #{e.message}")
    nil
  end

  # ── Generic RSS helpers ──────────────────────────────────────────────────────

  def extract_hero_image(doc)
    # BBC CDN full-res image
    bbc_img = doc.at_css("article img[src*='ichef.bbci.co.uk']")&.attr("src")
    return upscale_max(bbc_img) if bbc_img

    # og:image meta tag (most sites)
    og = doc.at_css("meta[property='og:image']")&.attr("content")
    return og if og&.match?(/\Ahttps?:\/\//)

    # First article image
    doc.at_css("article img[src]")&.attr("src")
  end

  def extract_paragraphs(doc)
    # Remove noise nodes before extracting text
    doc.css("script, style, nav, header, footer, aside, figure figcaption, [class*='related'], [class*='promo'], [class*='advert'], [class*='cookie'], [class*='banner']").remove

    candidates = [
      "article p",
      "[data-component='text-block'] p",
      ".article-body p",
      ".story-body p",
      ".entry-content p",
      "main article p",
      "main p"
    ]

    paras = nil
    candidates.each do |sel|
      nodes = doc.css(sel)
      if nodes.length >= 2
        paras = nodes
        break
      end
    end

    return [] unless paras

    paras
      .map { |p| p.text.strip }
      .reject { |t| t.length < 20 }   # skip captions / labels
      .uniq
      .first(30)
  end

  def fetch_feed(url, source)
    response = Faraday.get(url) do |req|
      req.options.timeout      = 5
      req.options.open_timeout = 3
      req.headers["User-Agent"] = "GolazoApp/1.0"
    end

    doc = Nokogiri::XML(response.body)
    doc.css("item").map { |item| parse_item(item, source) }.compact
  rescue => e
    Rails.logger.warn("[NewsService] #{source} failed: #{e.message}")
    []
  end

  def extract_link(item)
    url = item.at_css("link")&.text&.strip
    return url if url =~ /\Ahttps?:\/\//
    guid = item.at_css("guid")&.text&.strip
    guid if guid =~ /\Ahttps?:\/\//
  end

  def upscale(url)
    return url if url.blank?
    url.gsub(%r{/ace/standard/\d+/}, "/ace/standard/960/")
       .gsub(%r{/ace/ws/\d+/},       "/ace/ws/960/")
  end

  def upscale_max(url)
    return url if url.blank?
    url.gsub(%r{/ace/standard/\d+/}, "/ace/standard/2048/")
       .gsub(%r{/ace/ws/\d+/},       "/ace/ws/2048/")
  end

  def parse_item(item, source)
    title = item.at_css("title")&.text&.strip
    return nil if title.blank?

    link        = extract_link(item)
    summary     = item.at_css("description")&.text&.then { |t| Nokogiri::HTML(t).text.strip.truncate(300) }
    pub_str     = item.at_css("pubDate")&.text&.strip
    published   = pub_str ? Time.parse(pub_str) : nil
    image       = begin
                    node = item.at_xpath(".//*[local-name()='thumbnail' or local-name()='content']") ||
                           item.at_css("enclosure")
                    node&.attr("url")&.then { |u| upscale(u) }
                  rescue
                    nil
                  end
    id          = Digest::SHA1.hexdigest(link.to_s)[0, 12]

    {
      id:           id,
      title:        title,
      link:         link,
      summary:      summary,
      source:       source,
      image:        image,
      published_at: published,
      date_label:   published ? published.strftime("%-d %b %Y") : nil
    }
  rescue => e
    Rails.logger.warn("[NewsService] parse error: #{e.message}")
    nil
  end
end
