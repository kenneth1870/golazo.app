class FootballDataClient
  BASE_URL = "https://api.football-data.org/v4/"

  STATUS_MAP = {
    "TIMED"       => "scheduled",
    "SCHEDULED"   => "scheduled",
    "IN_PLAY"     => "live",
    "PAUSED"      => "live",
    "EXTRA_TIME"  => "live",
    "PENALTY"     => "live",
    "FINISHED"    => "finished",
    "AWARDED"     => "finished",
    "POSTPONED"   => "scheduled",
    "SUSPENDED"   => "scheduled",
    "CANCELLED"   => "scheduled",
  }.freeze

  def initialize
    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["X-Auth-Token"] = ENV.fetch("FOOTBALL_DATA_API_KEY")
      f.headers["Accept"]       = "application/json"
      f.request :retry, max: 2, interval: 1
      f.response :raise_error
    end
  end

  # All competitions available on the account
  def competitions
    get("competitions")["competitions"] || []
  end

  # Teams for a given competition code
  def teams(competition_code)
    get("competitions/#{competition_code}/teams")["teams"] || []
  end

  # All matches for a competition (optionally filtered)
  def matches(competition_code, params = {})
    get("competitions/#{competition_code}/matches", params)["matches"] || []
  end

  # Today's matches across ALL available competitions
  def today_matches
    today = Date.today.iso8601
    get("matches", dateFrom: today, dateTo: today)["matches"] || []
  end

  # Live matches across all competitions
  def live_matches
    get("matches", status: "IN_PLAY,PAUSED,EXTRA_TIME,PENALTY")["matches"] || []
  end

  # Standings for a competition
  def standings(competition_code)
    get("competitions/#{competition_code}/standings")["standings"] || []
  end

  # Top scorers for a competition
  def scorers(competition_code, limit: 20)
    get("competitions/#{competition_code}/scorers", limit: limit)["scorers"] || []
  end

  private

  def get(path, params = {})
    resp = @conn.get(path, params)
    JSON.parse(resp.body)
  rescue Faraday::Error => e
    Rails.logger.error("[FootballDataAPI] #{e.message}")
    {}
  end
end
