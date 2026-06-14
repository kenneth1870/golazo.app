# sw.js and manifest.json must never be cached long-term.
# The SW spec requires the browser to always revalidate sw.js so new
# service workers deploy immediately (not after a 1-year cache expires).
# manifest.json changes need to be picked up on next visit too.
class PwaCacheHeaders
  NO_STORE_PATHS = %w[/sw.js /manifest.json].freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    status, headers, body = @app.call(env)
    if NO_STORE_PATHS.include?(env["PATH_INFO"])
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
      headers.delete("Expires")
    end
    [ status, headers, body ]
  end
end

Rails.application.config.middleware.use PwaCacheHeaders
