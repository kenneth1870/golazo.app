# RapidAPI "Free API Live Football Data" client
# Covers: live scores (125+ leagues), all leagues list, player search
# Complements FootballDataClient which handles fixtures/standings/WC data
class LiveScoresClient
  BASE_URL = "https://free-api-live-football-data.p.rapidapi.com/"
  HOST     = "free-api-live-football-data.p.rapidapi.com"

  STATUS_MAP = {
    1  => "scheduled",  # Not started
    2  => "live",       # First half
    3  => "live",       # Second half
    4  => "live",       # Extra time
    5  => "live",       # Penalty shootout
    6  => "finished",   # Full time
    7  => "finished",   # After extra time
    8  => "finished",   # After penalties
    11 => "live",       # Half time
    12 => "live",       # Break time
  }.freeze

  def initialize
    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-rapidapi-key"]  = ENV.fetch("RAPIDAPI_KEY")
      f.headers["x-rapidapi-host"] = HOST
      f.headers["Content-Type"]    = "application/json"
      f.request :retry, max: 2, interval: 1
      f.response :raise_error
    end
  end

  # Returns all currently live matches across all 125+ leagues
  def live_matches
    data = get("football-current-live")
    data.dig("response", "live") || data.dig("response", "liveMatches") || []
  end

  # Returns all available leagues
  def leagues
    data = get("football-get-all-leagues")
    data.dig("response", "leagues") || []
  end

  # Search for players by name
  def search_players(query)
    data = get("football-players-search", search: query)
    data.dig("response", "suggestions") || []
  end

  private

  def get(path, params = {})
    resp = @conn.get(path, params)
    JSON.parse(resp.body)
  rescue Faraday::Error => e
    Rails.logger.error("[LiveScoresClient] #{e.message}")
    {}
  end
end
