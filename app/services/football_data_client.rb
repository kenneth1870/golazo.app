class FootballDataClient
  BASE_URL    = "https://api.football-data.org/v4/"
  WC_CODE     = "WC"

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

  def teams
    get("competitions/#{WC_CODE}/teams")["teams"] || []
  end

  def matches(params = {})
    get("competitions/#{WC_CODE}/matches", params)["matches"] || []
  end

  def live_matches
    get("competitions/#{WC_CODE}/matches", status: "IN_PLAY,PAUSED,EXTRA_TIME,PENALTY")["matches"] || []
  end

  def today_matches
    today = Date.today.iso8601
    get("competitions/#{WC_CODE}/matches", dateFrom: today, dateTo: today)["matches"] || []
  end

  def standings
    get("competitions/#{WC_CODE}/standings")["standings"] || []
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
