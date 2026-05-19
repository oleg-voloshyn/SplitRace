source 'https://rubygems.org'

ruby '4.0.4'

gem 'bootsnap', require: false
gem 'pg', '~> 1.1'
gem 'puma', '>= 5.0'
gem 'rails', '~> 8.1'
gem 'tzinfo-data', platforms: %i[windows jruby]

# Auth
gem 'bcrypt', '~> 3.1'
gem 'jwt', '~> 3.2'

# OmniAuth providers
gem 'multi_json', '~> 1.15'
gem 'omniauth', '~> 2.1'
gem 'omniauth-apple', '~> 1.0'
gem 'omniauth-google-oauth2', '~> 1.2'
gem 'omniauth-strava', '~> 1.0'
# omniauth-rails_csrf_protection not used — JWT API, not session-based

# PostGIS
gem 'activerecord-postgis-adapter', '~> 11.0'
gem 'rgeo', '~> 3.0'

# Background jobs
gem 'redis', '~> 5.0'
gem 'sidekiq', '~> 8.1'

# CORS
gem 'rack-cors', '~> 3.0'

# Admin views
gem 'slim-rails', '~> 4.0'

# Slugs
gem 'babosa', '~> 2.0'
gem 'friendly_id', '~> 5.5'

# Pagination
gem 'pagy', '~> 9.0'

group :development, :test do
  gem 'debug', platforms: %i[mri windows]
  gem 'dotenv-rails', '~> 3.1'
  gem 'rubocop', '~> 1.86', require: false
  gem 'rubocop-performance', '~> 1.26', require: false
  gem 'rubocop-rails', '~> 2.35', require: false
  gem 'rubocop-rspec', '~> 3.9', require: false
  gem 'rubocop-thread_safety', '~> 0.7', require: false
  gem 'simplecov', '~> 0.22', require: false
  gem 'simplecov-lcov', '~> 0.8', require: false
end
