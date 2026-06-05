# Server-rendered <title>/OG/Twitter metadata for the SPA shell, derived from
# the request path. The React app is client-rendered, so crawlers and social
# unfurlers that don't run JS would otherwise see one generic card for every
# URL. This gives each section a meaningful title/description.
#
# Per-entity enrichment (exact match score, team name) would require fetching
# data here; section-level metadata covers the common shared links cheaply.
class PageMeta
  Meta = Struct.new(:title, :description, :type, :image, keyword_init: true)

  SITE         = "Golazo — Mundial 2026".freeze
  DEFAULT_DESC = "Live scores, real-time stats, and every goal from the FIFA World Cup 2026 — USA · Canada · Mexico.".freeze
  DEFAULT_IMG  = "/images/bg_3.jpg".freeze

  # [path-prefix, title, description] — most specific first.
  RULES = [
    [ "/scores/live",     "Live Matches",      "World Cup 2026 matches live right now — scores, goals and the minute, updating in real time." ],
    [ "/scores/results",  "Results",           "Full-time results from the FIFA World Cup 2026." ],
    [ "/scores/fixtures", "Fixtures",          "Upcoming FIFA World Cup 2026 fixtures — dates, kickoff times and venues." ],
    [ "/scores/groups",   "Group Standings",   "Live group-stage standings for the FIFA World Cup 2026." ],
    [ "/scores/knockout", "Knockout Bracket",  "The FIFA World Cup 2026 knockout bracket — Round of 32 through the Final." ],
    [ "/scores/today",    "Today's Matches",   "Every FIFA World Cup 2026 match on today, with live scores." ],
    [ "/scores",          "Scores & Fixtures", DEFAULT_DESC ],
    [ "/groups",          "Groups",            "All 12 groups of the FIFA World Cup 2026." ],
    [ "/mundial/teams",   "Teams",             "All 48 nations at the FIFA World Cup 2026." ],
    [ "/mundial/schedule", "Schedule",         "The complete FIFA World Cup 2026 match schedule." ],
    [ "/mundial/venues",  "Venues & Stadiums", "The 16 host stadiums of the FIFA World Cup 2026." ],
    [ "/mundial/scorers", "Top Scorers",       "The FIFA World Cup 2026 top scorers race." ],
    [ "/mundial",         "Mundial 2026",      DEFAULT_DESC ],
    [ "/leagues",         "Leagues",           "Live scores from top leagues and competitions worldwide." ],
    [ "/news",            "Football News",     "The latest FIFA World Cup 2026 and international football news." ],
    [ "/matches",         "Match Center",      "World Cup 2026 match center — lineups, live stats, events and head-to-head." ],
    [ "/teams",           "Team Profile",      "FIFA World Cup 2026 team profile — squad, fixtures and results." ]
  ].freeze

  def self.for(path)
    path = path.to_s
    rule = RULES.find { |prefix, _, _| path == prefix || path.start_with?("#{prefix}/") }

    title = rule ? "#{rule[1]} — #{SITE}" : SITE
    desc  = rule ? rule[2] : DEFAULT_DESC
    type  = path.start_with?("/news/", "/matches/") ? "article" : "website"

    Meta.new(title: title, description: desc, type: type, image: DEFAULT_IMG)
  end
end
