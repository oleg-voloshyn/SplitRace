Rails.application.routes.draw do
  get 'up' => 'rails/health#show', as: :rails_health_check

  # OmniAuth callbacks
  get  '/auth/:provider/callback', to: 'api/v1/omniauth#callback'
  get  '/auth/failure',            to: 'api/v1/omniauth#failure'

  namespace :api do
    namespace :v1 do
      # Auth
      post   'auth/register', to: 'auth#register'
      post   'auth/login',    to: 'auth#login'
      post   'auth/google',   to: 'auth#google'

      # Current user
      get    'me',            to: 'users#me'
      patch  'me',            to: 'users#update_me'
      get    'notifications', to: 'notifications#index'
      patch  'notifications/:id/read', to: 'notifications#read', as: :read_notification
      post   'notifications/read_all', to: 'notifications#read_all'
      post   'push_tokens', to: 'push_tokens#create'
      delete 'push_tokens', to: 'push_tokens#destroy'

      # Segments
      resources :segments, only: %i[index show create]

      # Tournaments
      resources :tournaments, only: %i[index show create], param: :id do
        collection do
          get :mine
        end

        member do
          post   :submit_for_review
          post   :add_segment
          delete 'segments/:segment_id', to: 'tournaments#remove_segment', as: :segment
          get    :feed
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
    root to: 'dashboard#index'
    get  'login',  to: 'sessions#new', as: :login
    post 'login',  to: 'sessions#create'
    post 'logout', to: 'sessions#destroy', as: :logout

    resources :segments, only: %i[index new create edit update destroy]
    resources :tournaments, only: %i[index new create show edit update destroy] do
      member do
        post :activate
        post :approve
        post :reject
        post :complete
        post :add_segment
        post 'segments/:segment_id/remove', to: 'tournaments#remove_segment', as: :remove_segment
      end
    end
    resources :users, only: %i[index edit update]
    resources :activities, only: %i[index show]
    resources :cheating_reports, only: %i[index show update]
  end

  # Serve React PWA for all non-API routes
  pwa_proc = proc { [200, { 'Content-Type' => 'text/html' }, [Rails.public_path.join('app/index.html').read]] }
  root to: pwa_proc, constraints: ->(_req) { Rails.public_path.join('app/index.html').exist? }
  get '*path', to: pwa_proc,
               constraints: ->(req) { !req.path.start_with?('/api', '/auth', '/admin', '/up', '/app/') && Rails.public_path.join('app/index.html').exist? }
end
