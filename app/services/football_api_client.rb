class FootballApiClient
  BASE_URL = "https://v3.football.api-sports.io"
  WC_LEAGUE = 1
  WC_SEASON = 2022

  def initialize
    @conn = Faraday.new(url: BASE_URL) do |f|
      f.headers["x-apisports-key"] = ENV.fetch("FOOTBALL_API_KEY")
      f.headers["Accept"] = "application/json"
      f.request :retry, max: 2, interval: 1
      f.response :raise_error
    end
  end

  def teams
    get("/teams", league: WC_LEAGUE, season: WC_SEASON)
  end

  def fixtures(params = {})
    get("/fixtures", { league: WC_LEAGUE, season: WC_SEASON }.merge(params))
  end

  def live_fixtures
    get("/fixtures", league: WC_LEAGUE, live: "all")
  end

  def standings
    get("/standings", league: WC_LEAGUE, season: WC_SEASON)
  end

  def fixture_events(fixture_id)
    get("/fixtures/events", fixture: fixture_id)
  end

  def fixture_statistics(fixture_id)
    get("/fixtures/statistics", fixture: fixture_id)
  end

  private

  def get(path, params = {})
    resp = @conn.get(path, params)
    data = JSON.parse(resp.body)

    if data["errors"].is_a?(Hash) && data["errors"]["rateLimit"]
      Rails.logger.warn("[FootballAPI] Rate limited, sleeping 65s...")
      sleep 65
      return get(path, params)
    end

    raise "API error: #{data['errors']}" if data["errors"].is_a?(Array) && data["errors"].any?
    data["response"]
  rescue Faraday::Error => e
    Rails.logger.error("[FootballAPI] #{e.message}")
    []
  end
end
