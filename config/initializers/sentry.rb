# Error monitoring. Completely inert unless SENTRY_DSN is set, so local
# development and CI never phone home. sentry-rails auto-instruments unhandled
# controller and Active Job exceptions; swallowed upstream-API errors are
# reported explicitly via Sentry.capture_exception where they're rescued.
if ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.dsn                 = ENV["SENTRY_DSN"]
    config.environment         = Rails.env
    config.enabled_environments = %w[production staging]
    config.breadcrumbs_logger  = %i[active_support_logger http_logger]
    config.send_default_pii     = false
    config.traces_sample_rate  = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.1").to_f
  end
end
