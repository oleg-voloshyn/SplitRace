Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # OmniAuth callbacks
  get  "/auth/:provider/callback", to: "api/v1/omniauth#callback"
  get  "/auth/failure",            to: "api/v1/omniauth#failure"

  namespace :api do
    namespace :v1 do
      # Auth
      post   "auth/register", to: "auth#register"
      post   "auth/login",    to: "auth#login"

      # Current user
      get    "me",            to: "users#me"
      patch  "me",            to: "users#update_me"

      # Segments
      resources :segments, only: %i[index show]

      # Tournaments
      resources :tournaments, only: %i[index show create], param: :id do
        member do
          post   :join
          delete :leave
          get    :leaderboard
          patch  :activate
          patch  :complete
        end
      end

      # Activities
      resources :activities, only: %i[index create]

      # Cheating reports
      resources :cheating_reports, only: %i[create]
    end
  end

  # Admin panel (session-based, server-rendered)
  namespace :admin do
    root to: "dashboard#index"
    get  "login",  to: "sessions#new",     as: :login
    post "login",  to: "sessions#create"
    post "logout", to: "sessions#destroy", as: :logout

    resources :segments, only: %i[index new create edit update destroy]
    resources :tournaments, only: %i[index new create show edit update destroy] do
      member do
        post :activate
        post :complete
        post :add_segment
        post "segments/:segment_id/remove", to: "tournaments#remove_segment", as: :remove_segment
      end
    end
    resources :users, only: %i[index edit update]
    resources :activities, only: %i[index show]
    resources :cheating_reports, only: %i[index show update]
  end

  # Serve React PWA for all non-API routes
  pwa_proc = proc { [200, { "Content-Type" => "text/html" }, [File.read(Rails.root.join("public/app/index.html"))]] }
  root to: pwa_proc, constraints: ->(req) { File.exist?(Rails.root.join("public/app/index.html")) }
  get "*path", to: pwa_proc,
               constraints: ->(req) { !req.path.start_with?("/api", "/auth", "/admin", "/up", "/app/") && File.exist?(Rails.root.join("public/app/index.html")) }
end
