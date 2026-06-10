Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("ALLOWED_ORIGINS", "http://localhost:3036").split(",")

    resource "/api/*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ]

    resource "/cable",
      headers: :any,
      methods: [ :get, :post, :options ]
  end
end
