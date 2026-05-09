Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
           ENV["GOOGLE_CLIENT_ID"],
           ENV["GOOGLE_CLIENT_SECRET"],
           scope: "email,profile"

  provider :apple,
           ENV["APPLE_CLIENT_ID"],
           ENV["APPLE_PRIVATE_KEY"],
           scope:     "email name",
           team_id:   ENV["APPLE_TEAM_ID"],
           key_id:    ENV["APPLE_KEY_ID"]

  provider :strava,
           ENV["STRAVA_CLIENT_ID"],
           ENV["STRAVA_CLIENT_SECRET"],
           scope: "read,activity:read"
end

OmniAuth.config.allowed_request_methods = %i[get post]
OmniAuth.config.silence_get_warning = true
