# Rate limiting / throttling for the public API.
#
# Several endpoints are thin proxies to the paid RapidAPI (match detail, today,
# live scores, news, search, standings, scorers). Without throttling a single
# client can hammer them and run up the bill or exhaust the upstream quota.
#
# Uses Rails.cache as its backing store (Solid Cache in production, shared
# across processes/instances), so counters are consistent app-wide.
class Rack::Attack
  ### Throttle storage ###
  Rack::Attack.cache.store = Rails.cache

  ### Helpers ###
  API_PREFIX = "/api/"

  # Endpoints that fan out to the upstream paid API — throttled hardest.
  EXPENSIVE_PATHS = %w[
    /api/v1/match_detail
    /api/v1/match_preview
    /api/v1/today
    /api/v1/live_scores
    /api/v1/news
    /api/v1/search
    /api/v1/standings
    /api/v1/top_scorers
    /api/v1/all_leagues
    /api/v1/fixtures
    /api/v1/results
  ].freeze

  def self.api_request?(req)
    req.path.start_with?(API_PREFIX)
  end

  def self.expensive_request?(req)
    EXPENSIVE_PATHS.any? { |p| req.path.start_with?(p) }
  end

  ### Throttles ###

  # Broad ceiling on all API traffic per IP.
  throttle("api/ip", limit: 300, period: 5.minutes) do |req|
    req.ip if api_request?(req)
  end

  # Tighter ceiling on the upstream-proxying endpoints per IP.
  throttle("api/expensive/ip", limit: 60, period: 1.minute) do |req|
    req.ip if expensive_request?(req)
  end

  # Write/vote endpoints (POST/PATCH/PUT) per IP — abuse + spam protection
  # (predictions also have a per-match 24h limit; this is a global backstop).
  throttle("api/writes/ip", limit: 20, period: 1.minute) do |req|
    req.ip if api_request?(req) && !req.get? && !req.head?
  end

  ### Safelist ###
  # Never throttle local development traffic.
  safelist("allow/localhost") do |req|
    [ "127.0.0.1", "::1" ].include?(req.ip) && !Rails.env.production?
  end

  ### Custom 429 response ###
  self.throttled_responder = lambda do |req|
    match_data = req.env["rack.attack.match_data"] || {}
    retry_after = (match_data[:period] || 60).to_s
    [
      429,
      { "Content-Type" => "application/json", "Retry-After" => retry_after },
      [ { error: "rate_limited", retry_after: retry_after.to_i }.to_json ]
    ]
  end
end

# Rack::Attack is not auto-inserted into the middleware stack.
Rails.application.config.middleware.use Rack::Attack
