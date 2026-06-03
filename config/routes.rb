Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :competitions, only: [:index, :show], param: :code
      resources :teams, only: [:index, :show]
      resources :standings, only: [:index]
      get "top_scorers", to: "top_scorers#index"
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
