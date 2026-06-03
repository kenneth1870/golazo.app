Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :competitions, only: [:index, :show], param: :code
      get "live_scores", to: "live_scores#index"
      resources :teams, only: [:index, :show]
      resources :standings, only: [:index]
resources :matches, only: [:index, :show, :update] do
        resources :goals, only: [:create]
        resource :stats, only: [] do
          post :upsert, on: :collection
        end
      end
    end
  end

  # ActionCable
  mount ActionCable.server => "/cable"

  # Catch-all: serve the React SPA
  get "*path", to: "application#spa", constraints: ->(req) { !req.xhr? && req.format.html? }
  root "application#spa"
end
