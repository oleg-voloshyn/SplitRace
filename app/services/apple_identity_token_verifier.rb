require 'jwt'
require 'net/http'
require 'json'

class AppleIdentityTokenVerifier
  APPLE_KEYS_URL = URI('https://appleid.apple.com/auth/keys').freeze
  APPLE_ISSUER   = 'https://appleid.apple.com'
  BUNDLE_ID      = 'com.splitrace.app'

  class Error < StandardError; end

  def verify!(identity_token)
    raise Error, 'Missing Apple token' if identity_token.blank?

    jwks = { keys: fetch_apple_keys }

    payload, = JWT.decode(
      identity_token,
      nil,
      true,
      algorithms: %w[RS256 ES256],
      iss: APPLE_ISSUER,
      verify_iss: true,
      aud: BUNDLE_ID,
      verify_aud: true,
      jwks:
    )

    raise Error, 'Apple account sub is missing' if payload['sub'].blank?

    payload
  rescue JWT::DecodeError, JWT::VerificationError => e
    raise Error, "Apple token verification failed: #{e.message}"
  end

  private

  def fetch_apple_keys
    response = Net::HTTP.start(
      APPLE_KEYS_URL.host, APPLE_KEYS_URL.port,
      use_ssl: true, open_timeout: 3, read_timeout: 3
    ) { |http| http.get(APPLE_KEYS_URL.request_uri) }

    raise Error, 'Failed to fetch Apple public keys' unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)['keys']
  rescue JSON::ParserError, SocketError, Timeout::Error, Errno::ECONNREFUSED
    raise Error, 'Failed to fetch Apple public keys'
  end
end
