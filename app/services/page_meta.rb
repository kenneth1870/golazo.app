# Server-rendered <title>/OG/Twitter/JSON-LD metadata for the SPA shell.
# The React app is client-rendered, so crawlers and social unfurlers that
# don't run JS would see one generic card for every URL.
# This gives each section — AND each entity page — a meaningful card.
class PageMeta
  Meta = Struct.new(:title, :description, :type, :image, :json_ld, keyword_init: true)

  SITE         = "Golazo — Mundial 2026".freeze
  DEFAULT_DESC = "Live scores, real-time stats, and every goal from the FIFA World Cup 2026 — USA · Canada · Mexico.".freeze
  DEFAULT_IMG  = "/images/bg_3.jpg".freeze
  BASE_URL     = "https://golazo.app".freeze

  # [path-prefix, title, description] — most specific first.
  RULES = [
    [ "/scores/live",      "Live Matches",      "World Cup 2026 matches live right now — scores, goals and the minute, updating in real time." ],
    [ "/scores/results",   "Results",           "Full-time results from the FIFA World Cup 2026." ],
    [ "/scores/fixtures",  "Fixtures",          "Upcoming FIFA World Cup 2026 fixtures — dates, kickoff times and venues." ],
    [ "/scores/groups",    "Group Standings",   "Live group-stage standings for the FIFA World Cup 2026." ],
    [ "/scores/knockout",  "Knockout Bracket",  "The FIFA World Cup 2026 knockout bracket — Round of 32 through the Final." ],
    [ "/scores/today",     "Today's Matches",   "Every FIFA World Cup 2026 match on today, with live scores." ],
    [ "/scores",           "Scores & Fixtures", DEFAULT_DESC ],
    [ "/groups",           "Groups",            "All 12 groups of the FIFA World Cup 2026." ],
    [ "/mundial/teams",    "Teams",             "All 48 nations at the FIFA World Cup 2026." ],
    [ "/mundial/schedule", "Schedule",          "The complete FIFA World Cup 2026 match schedule." ],
    [ "/mundial/venues",   "Venues & Stadiums", "The 16 host stadiums of the FIFA World Cup 2026." ],
    [ "/mundial/scorers",  "Top Scorers",       "The FIFA World Cup 2026 top scorers race." ],
    [ "/mundial",          "Mundial 2026",      DEFAULT_DESC ],
    [ "/leagues",          "Leagues",           "Live scores from top leagues and competitions worldwide." ],
    [ "/leaderboard",      "Prediction Leaderboard", "See who's winning the Golazo score-prediction leaderboard for World Cup 2026." ],
    [ "/predictor",        "Bracket Predictor", "Predict the FIFA World Cup 2026 knockout bracket." ],
    [ "/news",             "Football News",     "The latest FIFA World Cup 2026 and international football news." ],
    [ "/matches",          "Match Center",      "World Cup 2026 match center — lineups, live stats, events and head-to-head." ],
    [ "/teams",            "Team Profile",      "FIFA World Cup 2026 team profile — squad, fixtures and results." ],
    [ "/players",          "Player Profile",    "FIFA World Cup 2026 player stats — goals, assists, minutes and more." ]
  ].freeze

  def self.for(path)
    path = path.to_s

    # ── Dynamic entity pages ────────────────────────────────────────────
    # Handles /matches/1489391 (external_id) and /matches/db-42 (db primary key)
    if (m = path.match(%r{\A/matches/((?:db-)?\d+)\z}))
      return for_match(m[1])
    end

    if (m = path.match(%r{\A/teams/(\d+)\z}))
      return for_team(m[1])
    end

    if (m = path.match(%r{\A/mundial/venues/([^/]+)\z}))
      return for_venue(m[1])
    end

    if (m = path.match(%r{\A/players/(\d+)\z}))
      return for_player(m[1])
    end

    if (m = path.match(%r{\A/leagues/([A-Z0-9]+)\z}i))
      return for_league(m[1])
    end

    if (m = path.match(%r{\A/news/([a-zA-Z0-9]+)\z}))
      return for_news(m[1])
    end

    return for_home if path == "/" || path == ""

    # ── Section-level rules ─────────────────────────────────────────────
    rule  = RULES.find { |prefix, _| path == prefix || path.start_with?("#{prefix}/") }
    title = rule ? "#{rule[1]} — #{SITE}" : SITE
    desc  = rule ? rule[2] : DEFAULT_DESC
    type  = path.start_with?("/news/", "/matches/") ? "article" : "website"

    Meta.new(title: title, description: desc, type: type, image: DEFAULT_IMG, json_ld: nil)
  end

  # ── Entity-level helpers ──────────────────────────────────────────────

  def self.for_home
    Rails.cache.fetch("page_meta_home", expires_in: 30.seconds) { build_home_meta }
  rescue => e
    Rails.logger.error("[PageMeta.for_home] #{e.message}")
    Meta.new(title: SITE, description: DEFAULT_DESC, type: "website", image: DEFAULT_IMG, json_ld: nil)
  end

  def self.build_home_meta
    wc_scope = Match.joins(:competition).where(competitions: { code: "WC" }).includes(:home_team, :away_team)

    # Priority 1 — live matches right now
    live = wc_scope.where(status: "live").order(:kickoff_at).limit(3).to_a
    if live.any?
      first = live.first
      home  = first.home_team&.name || "TBD"
      away  = first.away_team&.name || "TBD"
      score = "#{first.home_score}–#{first.away_score}"
      more  = live.size > 1 ? " +#{live.size - 1} more" : ""
      return Meta.new(
        title:       "🔴 LIVE: #{home} #{score} #{away}#{more} — #{SITE}",
        description: "#{live.size} match#{"es" if live.size > 1} live now at the FIFA World Cup 2026. " \
                     "Follow every goal in real time on Golazo.",
        type:        "website",
        image:       DEFAULT_IMG,
        json_ld:     nil
      )
    end

    # Priority 2 — today's scheduled / finished matches (UTC window ±1h for timezone tolerance)
    window = (Time.current.beginning_of_day - 1.hour)..(Time.current.end_of_day + 1.hour)
    today  = wc_scope.where(kickoff_at: window)
                     .where(status: %w[scheduled finished])
                     .order(:kickoff_at)
                     .limit(4)
                     .to_a
    if today.any?
      first = today.first
      home  = first.home_team&.name || "TBD"
      away  = first.away_team&.name || "TBD"
      more  = today.size > 1 ? " +#{today.size - 1} more today" : ""
      return Meta.new(
        title:       "#{home} vs #{away}#{more} — #{SITE}",
        description: "#{today.size} World Cup match#{"es" if today.size > 1} today. " \
                     "Live scores, goals and stats on Golazo — FIFA World Cup 2026.",
        type:        "website",
        image:       DEFAULT_IMG,
        json_ld:     nil
      )
    end

    # Fallback — no matches today
    Meta.new(title: SITE, description: DEFAULT_DESC, type: "website", image: DEFAULT_IMG, json_ld: nil)
  end
  private_class_method :build_home_meta

  def self.for_match(raw_id)
    # /matches/db-42  → look up by internal primary key
    # /matches/1489391 → look up by external_id (the API-Football numeric ID used in all navigation links)
    match = if raw_id.to_s.start_with?("db-")
      Match.includes(:home_team, :away_team, :competition).find_by(id: raw_id.sub("db-", ""))
    else
      Match.includes(:home_team, :away_team, :competition).find_by(external_id: raw_id) ||
        Match.includes(:home_team, :away_team, :competition).find_by(id: raw_id)
    end
    id = raw_id
    return default_meta unless match

    home = match.home_team&.name || "TBD"
    away = match.away_team&.name || "TBD"
    comp = match.competition&.name || "FIFA World Cup 2026"

    if match.status == "finished"
      score = "#{match.home_score}–#{match.away_score}"
      title = "#{home} #{score} #{away} — #{comp}"
      desc  = "Full-time: #{home} #{score} #{away} at the #{comp}. Match report, stats, lineups and events on Golazo."
    elsif match.status == "live"
      score = "#{match.home_score}–#{match.away_score}"
      title = "LIVE: #{home} #{score} #{away} — #{comp}"
      desc  = "Live now: #{home} vs #{away} at the #{comp}. Follow every goal and event in real time on Golazo."
    else
      kickoff = match.kickoff_at&.strftime("%d %b %Y, %H:%M UTC") || "upcoming"
      title = "#{home} vs #{away} — #{comp}"
      desc  = "#{home} vs #{away} at the #{comp}, #{kickoff}. Preview, lineups and live updates on Golazo."
    end

    json_ld = {
      "@context" => "https://schema.org",
      "@type"    => "SportsEvent",
      "name"     => "#{home} vs #{away}",
      "description" => desc,
      "startDate" => match.kickoff_at&.iso8601,
      "url"       => "#{BASE_URL}/matches/#{id}",
      "sport"     => "Football",
      "location"  => match.venue.present? ? { "@type" => "Place", "name" => match.venue } : nil,
      "homeTeam"  => { "@type" => "SportsTeam", "name" => home },
      "awayTeam"  => { "@type" => "SportsTeam", "name" => away },
      "organizer" => { "@type" => "Organization", "name" => "FIFA", "url" => "https://www.fifa.com" }
    }.compact
    json_ld["location"] = nil if json_ld["location"].nil?
    json_ld.compact!

    Meta.new(
      title:       "#{title} — #{SITE}",
      description: desc,
      type:        "article",
      image:       match.home_team&.flag_url || DEFAULT_IMG,
      json_ld:     json_ld
    )
  rescue => e
    Rails.logger.error("[PageMeta.for_match] #{e.message}")
    default_meta
  end

  def self.for_team(id)
    team = Team.find_by(id: id)
    return default_meta unless team

    title = "#{team.name} — FIFA World Cup 2026"
    desc  = "#{team.name} squad, fixtures, results and World Cup 2026 stats on Golazo."

    json_ld = {
      "@context" => "https://schema.org",
      "@type"    => "SportsTeam",
      "name"     => team.name,
      "url"      => "#{BASE_URL}/teams/#{id}",
      "sport"    => "Football",
      "logo"     => team.flag_url.presence
    }.compact

    Meta.new(
      title:       "#{title} — #{SITE}",
      description: desc,
      type:        "website",
      image:       team.flag_url || DEFAULT_IMG,
      json_ld:     json_ld
    )
  rescue => e
    Rails.logger.error("[PageMeta.for_team] #{e.message}")
    default_meta
  end

  def self.for_player(id)
    # Players come from external API, not local DB — use generic meta
    Meta.new(
      title:       "Player Profile — #{SITE}",
      description: "FIFA World Cup 2026 player stats — goals, assists, minutes and more on Golazo.",
      type:        "website",
      image:       DEFAULT_IMG,
      json_ld:     nil
    )
  end

  def self.for_league(code)
    comp = Competition.find_by(code: code.upcase)
    return default_meta unless comp

    title = "#{comp.name} — Live Scores & Standings"
    desc  = "Live scores, standings and results for #{comp.name} on Golazo."

    Meta.new(
      title:       "#{title} — #{SITE}",
      description: desc,
      type:        "website",
      image:       comp.logo || DEFAULT_IMG,
      json_ld:     nil
    )
  rescue => e
    Rails.logger.error("[PageMeta.for_league] #{e.message}")
    default_meta
  end

  VENUE_SLUGS = {
    "metlife-stadium"         => { name: "MetLife Stadium",         city: "East Rutherford, NJ", country: "USA"    },
    "at-t-stadium"            => { name: "AT&T Stadium",            city: "Arlington, TX",        country: "USA"    },
    "arrowhead-stadium"       => { name: "Arrowhead Stadium",       city: "Kansas City, MO",      country: "USA"    },
    "lumen-field"             => { name: "Lumen Field",             city: "Seattle, WA",          country: "USA"    },
    "nrg-stadium"             => { name: "NRG Stadium",             city: "Houston, TX",          country: "USA"    },
    "mercedes-benz-stadium"   => { name: "Mercedes-Benz Stadium",   city: "Atlanta, GA",          country: "USA"    },
    "lincoln-financial-field" => { name: "Lincoln Financial Field", city: "Philadelphia, PA",     country: "USA"    },
    "sofi-stadium"            => { name: "SoFi Stadium",            city: "Inglewood, CA",        country: "USA"    },
    "levi-s-stadium"          => { name: "Levi's Stadium",          city: "Santa Clara, CA",      country: "USA"    },
    "hard-rock-stadium"       => { name: "Hard Rock Stadium",       city: "Miami Gardens, FL",    country: "USA"    },
    "gillette-stadium"        => { name: "Gillette Stadium",        city: "Foxborough, MA",       country: "USA"    },
    "bc-place"                => { name: "BC Place",                city: "Vancouver, BC",        country: "Canada" },
    "bmo-field"               => { name: "BMO Field",               city: "Toronto, ON",          country: "Canada" },
    "estadio-azteca"          => { name: "Estadio Azteca",          city: "Mexico City",          country: "Mexico" },
    "estadio-bbva"            => { name: "Estadio BBVA",            city: "Monterrey",            country: "Mexico" },
    "estadio-akron"           => { name: "Estadio Akron",           city: "Guadalajara",          country: "Mexico" }
  }.freeze

  def self.for_venue(slug)
    # Accept city-appended slugs (e.g. "lumen-field-seattle" → matches "lumen-field")
    _vs, venue = VENUE_SLUGS.find { |vs, _| slug == vs || slug.start_with?("#{vs}-") }
    return default_meta unless venue

    title = "#{venue[:name]} — FIFA World Cup 2026"
    desc  = "#{venue[:name]} in #{venue[:city]}, #{venue[:country]} hosts FIFA World Cup 2026 matches. " \
            "Fixtures, results and venue details on Golazo."

    Meta.new(title: "#{title} — #{SITE}", description: desc, type: "website", image: DEFAULT_IMG, json_ld: nil)
  rescue => e
    Rails.logger.error("[PageMeta.for_venue] #{e.message}")
    default_meta
  end

  def self.for_news(id)
    article = Rails.cache.fetch("page_meta_news_#{id}", expires_in: 15.minutes) do
      NewsService.new.latest(limit: 60, lang: "en").find { |a| a[:id].to_s == id.to_s } ||
        NewsService.new.latest(limit: 60, lang: "es").find { |a| a[:id].to_s == id.to_s }
    end

    return Meta.new(
      title:       "Football News — #{SITE}",
      description: "The latest FIFA World Cup 2026 and international football news on Golazo.",
      type:        "article",
      image:       DEFAULT_IMG,
      json_ld:     nil
    ) unless article

    title = article[:title].presence || "Football News"
    desc  = article[:summary].presence || title
    image = article[:image].presence || DEFAULT_IMG

    json_ld = {
      "@context"        => "https://schema.org",
      "@type"           => "NewsArticle",
      "headline"        => title.truncate(110),
      "description"     => desc.truncate(300),
      "image"           => image,
      "datePublished"   => article[:published_at]&.iso8601,
      "url"             => "#{BASE_URL}/news/#{id}",
      "publisher"       => {
        "@type" => "Organization",
        "name"  => article[:source] || "Golazo",
        "logo"  => { "@type" => "ImageObject", "url" => "#{BASE_URL}/images/apple-touch-icon.png?v=2" }
      }
    }.compact

    Meta.new(
      title:       "#{title} — #{SITE}",
      description: desc.truncate(160),
      type:        "article",
      image:       image,
      json_ld:     json_ld
    )
  rescue => e
    Rails.logger.error("[PageMeta.for_news] #{e.message}")
    Meta.new(
      title:       "Football News — #{SITE}",
      description: "The latest FIFA World Cup 2026 and international football news on Golazo.",
      type:        "article",
      image:       DEFAULT_IMG,
      json_ld:     nil
    )
  end

  def self.default_meta
    Meta.new(title: SITE, description: DEFAULT_DESC, type: "website", image: DEFAULT_IMG, json_ld: nil)
  end
  private_class_method :default_meta
end
