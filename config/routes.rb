Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # ── Auth ────────────────────────────────────────────
      post   "sessions",          to: "sessions#create"
      get    "sessions/me",       to: "sessions#me"
      delete "sessions",          to: "sessions#logout"
      post   "sessions/register", to: "sessions#register"
      post   "sessions/google",   to: "sessions#google"

      # ── Admin ────────────────────────────────────────────
      namespace :admin do
        get "/",           to: "dashboard#index"
        resources :matches, only: %i[index show update]
        resources :users,   only: %i[index show update destroy]
        resources :news,    only: %i[index]
        resources :teams,   only: %i[index update]
        get  "standings",         to: "standings#index"
        post "standings/recalculate", to: "standings#recalculate"
        get  "push",          to: "push#index"
        get  "push/devices",  to: "push#devices"
        post "push/broadcast", to: "push#broadcast"
        get  "devices",       to: "devices#index"
      end

      resources :competitions, only: [ :index, :show ], param: :code
      get "search",       to: "search#index"
      get "locale",       to: "locale#index"
      get "live_scores",  to: "live_scores#index"
      get "live_count",   to: "live_scores#count"
      get "today",        to: "today#index"
      get "match_detail/:id",            to: "match_detail#show"
      get "match_detail/:id/ai_summary", to: "match_detail#ai_summary"
      get  "match_preview",             to: "match_detail#preview"
      get  "predictions/:match_id",     to: "predictions#show"
      post "predictions/:match_id/vote", to: "predictions#vote"
      get  "score_predictions/leaderboard",  to: "score_predictions#leaderboard"
      get  "score_predictions/by_device",    to: "score_predictions#by_device"
      get  "score_predictions/:match_id",    to: "score_predictions#show"
      post "score_predictions/:match_id",    to: "score_predictions#create"
      get "fixtures",         to: "fixtures#index"
      get "results",      to: "results#index"
      get "news",         to: "news#index"
      get "news/:id",         to: "news#show"
      get "news/:id/content", to: "news#content"
      get "top_scorers",  to: "top_scorers#index"
      get "top_assists",  to: "top_scorers#assists"
      get "top_cards",    to: "top_scorers#cards"
      get "fixture_ratings/:fixture_id",  to: "fixture_ratings#show"
      get "fixture_injuries/:fixture_id", to: "fixture_injuries#show"
      get "venue_detail/:id",             to: "venue_detail#show"
      get "venues",       to: "venues#index"
      get "all_leagues",  to: "all_leagues#index"
      get "all_leagues/live", to: "all_leagues#live"
      get  "vapid_public_key",         to: "push_subscriptions#vapid_key"
      post "push_subscriptions",       to: "push_subscriptions#create"
      put  "push_subscriptions/teams", to: "push_subscriptions#update_teams"
      delete "push_subscriptions",     to: "push_subscriptions#destroy"
      post "push_test",                to: "push_subscriptions#test_push"
      post "track",                    to: "tracking#ping"
      resources :teams, only: [ :index, :show ] do
        get :squad, on: :member
      end
      get "fixture_predictions/:fixture_id", to: "fixture_predictions#show"
      get "fixture_odds/:fixture_id/live",  to: "fixture_odds#live"
      get "fixture_odds/:fixture_id",       to: "fixture_odds#show"

      resources :players,  only: [ :show ] do
        collection { get :search }
        member do
          get :trophies
          get :sidelined
        end
      end
      resources :standings, only: [ :index ]
      resources :matches, only: [ :index, :show, :update ] do
        resources :goals,     only: [ :create ]
        # singular resource: GET /matches/:match_id/reactions (no :id needed)
        resource :reactions, only: [], controller: "match_reactions" do
          get  "/",  to: "match_reactions#show",  on: :collection
          post "/",  to: "match_reactions#create", on: :collection
        end
        resource :stats, only: [] do
          post :upsert, on: :collection
        end
        get :ai_summary, to: "ai_summaries#show", on: :member
      end
    end
  end

  mount ActionCable.server => "/cable"

  # Sitemap
  get "sitemap.xml", to: "sitemap#index", defaults: { format: :xml }

  # SPA catch-all — must come before engine mounts so the app root takes priority.
  # Exclude /jobs and /solid-queue so those engine requests reach the engines below.
  get "*path", to: "application#spa", constraints: ->(req) {
    !req.xhr? && req.format.html? && !req.path.start_with?("/jobs") && !req.path.start_with?("/solid-queue")
  }
  root "application#spa"

  mount MissionControl::Jobs::Engine, at: "/jobs"

  solid_queue_app = if Rails.env.development?
    SolidQueueDashboard::Engine
  else
    Rack::Auth::Basic.new(SolidQueueDashboard::Engine, "Solid Queue Dashboard") do |user, pass|
      ActiveSupport::SecurityUtils.secure_compare(user, ENV.fetch("JOBS_USER")) &&
        ActiveSupport::SecurityUtils.secure_compare(pass, ENV.fetch("JOBS_PASSWORD"))
    end
  end
  mount solid_queue_app, at: "/solid-queue"
end
