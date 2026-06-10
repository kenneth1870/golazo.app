class NewsService
  # Primary feeds per locale. Falls back to English when a locale has no feeds.
  FEEDS = {
    "en" => [
      { url: "https://feeds.bbci.co.uk/sport/football/rss.xml",               source: "BBC Sport"       },
      { url: "https://www.espn.com/espn/rss/soccer/news",                      source: "ESPN FC"         },
      { url: "https://www.goal.com/feeds/en/news",                             source: "Goal.com"        }
    ],
    "es" => [
      { url: "https://espndeportes.espn.com/espn/rss/deportes/soccer/noticias", source: "ESPN Deportes"  },
      { url: "https://e00-marca.uecdn.es/rss/futbol.xml",                       source: "Marca"          }
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

  def latest(limit: 20, lang: "en")
    feeds = FEEDS[lang] || FEEDS["en"]
    Rails.cache.fetch("news_feed_v3_#{lang}", expires_in: 30.minutes) do
      threads = feeds.map { |feed| Thread.new { fetch_feed(feed[:url], feed[:source]) } }
      items   = threads.flat_map { |t| t.join(8)&.value || [] }
      items.uniq { |a| a[:link] }
           .sort_by { |a| a[:published_at] || Time.at(0) }.reverse
           .first(limit)
    end
  end

  # Fetches and parses the full article body from the original URL.
  # Returns { paragraphs: [...], hero_image: url, hero_alt: str }
  def fetch_content(url)
    return nil if url.blank?

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
