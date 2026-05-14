source "https://rubygems.org"

ruby "4.0.4"

gem "rails", "~> 8.1"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "bootsnap", require: false
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Auth
gem "bcrypt", "~> 3.1"
gem "jwt", "~> 3.2"

# OmniAuth providers
gem "omniauth", "~> 2.1"
gem "omniauth-google-oauth2", "~> 1.2"
gem "omniauth-apple", "~> 1.0"
gem "omniauth-strava", "~> 1.0"
gem "multi_json", "~> 1.15"
# omniauth-rails_csrf_protection not used — JWT API, not session-based

# PostGIS
gem "rgeo", "~> 3.0"
gem "activerecord-postgis-adapter", "~> 11.0"

# Background jobs
gem "sidekiq", "~> 8.1"
gem "redis", "~> 5.0"

# CORS
gem "rack-cors", "~> 3.0"

# Admin views
gem "slim-rails", "~> 4.0"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ]
  gem "dotenv-rails", "~> 3.1"
end
