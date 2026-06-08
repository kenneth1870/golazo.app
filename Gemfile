source "https://rubygems.org"

# Gems extracted from Ruby stdlib — required explicitly on Ruby 3.3+
gem "mutex_m"
gem "base64"
gem "ostruct"
gem "bigdecimal"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 8.1"
# Use PostgreSQL as the database for Active Record
gem "pg", "~> 1.1"
# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"
# Background jobs + recurring scheduler
gem "solid_queue"
# Database-backed cache store (shared across web + worker processes, durable)
gem "solid_cache"
# Database-backed Action Cable adapter (cross-process pub/sub for live updates)
gem "solid_cable"
# Vite integration for React frontend
gem "vite_rails"
# CORS for API requests
gem "rack-cors"
# Rate limiting / throttling for the public API
gem "rack-attack"
# Error monitoring (no-op unless SENTRY_DSN is set)
gem "sentry-ruby"
gem "sentry-rails"
# HTTP client for external APIs
gem "faraday"
gem "faraday-retry"
# HTML parsing for news article content extraction
gem "nokogiri"
# Web Push notifications (VAPID)
gem "web-push"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
# gem "bcrypt", "~> 3.1.7"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Use the database-backed adapters for Rails.cache, Active Job, and Action Cable
# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Deploy this application anywhere as a Docker container [https://kamal-deploy.org]
gem "kamal", require: false

# Add HTTP asset caching/compression and X-Sendfile acceleration to Puma [https://github.com/basecamp/thruster/]
gem "thruster", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
gem "image_processing", "~> 1.2", require: false

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"

  # Audits gems for known security defects (use config/bundler-audit.yml to ignore issues)
  gem "bundler-audit", require: false

  # Static analysis for security vulnerabilities [https://brakemanscanner.org/]
  gem "brakeman", require: false

  # Omakase Ruby styling [https://github.com/rails/rubocop-rails-omakase/]
  gem "rubocop-rails-omakase", require: false
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "web-console"
end

group :test do
  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem "capybara"
  gem "selenium-webdriver"
end
