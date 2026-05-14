Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2,
           ENV.fetch('GOOGLE_CLIENT_ID', nil),
           ENV.fetch('GOOGLE_CLIENT_SECRET', nil),
           scope: 'email,profile'

  provider :apple,
           ENV.fetch('APPLE_CLIENT_ID', nil),
           ENV.fetch('APPLE_PRIVATE_KEY', nil),
           scope: 'email name',
           team_id: ENV.fetch('APPLE_TEAM_ID', nil),
           key_id: ENV.fetch('APPLE_KEY_ID', nil)

  provider :strava,
           ENV.fetch('STRAVA_CLIENT_ID', nil),
           ENV.fetch('STRAVA_CLIENT_SECRET', nil),
           scope: 'read,activity:read'
end

OmniAuth.config.allowed_request_methods = %i[get post]
OmniAuth.config.silence_get_warning = true
