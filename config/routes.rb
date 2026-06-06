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
      get "match_detail/:id",      to: "match_detail#show"
      get  "match_preview",             to: "match_detail#preview"
      get  "predictions/:match_id",     to: "predictions#show"
      post "predictions/:match_id/vote", to: "predictions#vote"
      get "fixtures",         to: "fixtures#index"
      get "results",      to: "results#index"
      get "news",         to: "news#index"
      get "news/:id",         to: "news#show"
      get "news/:id/content", to: "news#content"
      get "top_scorers",  to: "top_scorers#index"
      get "venues",       to: "venues#index"
      get "all_leagues",  to: "all_leagues#index"
      get "all_leagues/live", to: "all_leagues#live"
      resources :teams,    only: [:index, :show]
      resources :standings, only: [:index]
      resources :matches, only: [:index, :show, :update] do
        resources :goals, only: [:create]
        resource :stats, only: [] do
          post :upsert, on: :collection
        end
      end
    end
  end

  mount ActionCable.server => "/cable"

  get "*path", to: "application#spa", constraints: ->(req) { !req.xhr? && req.format.html? }
  root "application#spa"
end
