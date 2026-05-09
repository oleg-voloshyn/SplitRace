source "https://rubygems.org"

ruby "3.4.8"

gem "rails", "~> 8.1"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "bootsnap", require: false
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Auth
gem "bcrypt", "~> 3.1"
gem "jwt", "~> 2.9"

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
gem "sidekiq", "~> 7.3"
gem "redis", "~> 5.0"

# CORS
gem "rack-cors", "~> 2.0"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ]
  gem "dotenv-rails", "~> 3.1"
end
