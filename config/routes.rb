Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :competitions, only: [:index, :show], param: :code
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
      get "venues",       to: "venues#index"
      get "all_leagues",  to: "all_leagues#index"
      get "all_leagues/live", to: "all_leagues#live"
      get  "vapid_public_key",         to: "push_subscriptions#vapid_key"
      post "push_subscriptions",       to: "push_subscriptions#create"
      put  "push_subscriptions/teams", to: "push_subscriptions#update_teams"
      delete "push_subscriptions",     to: "push_subscriptions#destroy"
      resources :teams, only: [:index, :show] do
        get :squad, on: :member
      end
      get "fixture_predictions/:fixture_id", to: "fixture_predictions#show"
      get "fixture_odds/:fixture_id/live",  to: "fixture_odds#live"
      get "fixture_odds/:fixture_id",       to: "fixture_odds#show"

      resources :players,  only: [:show] do
        collection { get :search }
        member do
          get :transfers
          get :trophies
          get :sidelined
        end
      end
      resources :standings, only: [:index]
      resources :matches, only: [:index, :show, :update] do
        resources :goals, only: [:create]
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

  get "*path", to: "application#spa", constraints: ->(req) { !req.xhr? && req.format.html? }
  root "application#spa"
end
