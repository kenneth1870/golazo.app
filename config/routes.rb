Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :competitions, only: [:index, :show], param: :code
      get "live_scores",  to: "live_scores#index"
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
