require 'json'
require 'net/http'

class GoogleIdentityTokenVerifier
  TOKENINFO_URL = URI('https://oauth2.googleapis.com/tokeninfo').freeze

  class Error < StandardError; end

  def verify!(id_token)
    raise Error, 'Missing Google token' if id_token.blank?

    client_ids = configured_client_ids
    raise Error, 'Google OAuth client id is not configured' if client_ids.empty?

    payload = fetch_tokeninfo(id_token)
    validate_payload!(payload, client_ids)
    payload
  end

  private

  def configured_client_ids
    %w[
      GOOGLE_CLIENT_ID
      GOOGLE_WEB_CLIENT_ID
      GOOGLE_IOS_CLIENT_ID
      GOOGLE_ANDROID_CLIENT_ID
      GOOGLE_EXPO_CLIENT_ID
    ].filter_map { |key| ENV[key].presence }.uniq
  end

  def fetch_tokeninfo(id_token)
    uri = TOKENINFO_URL.dup
    uri.query = URI.encode_www_form(id_token:)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 3, read_timeout: 3) do |http|
      http.get(uri.request_uri)
    end
    raise Error, 'Google token verification failed' unless response.is_a?(Net::HTTPSuccess)

    JSON.parse(response.body)
  rescue JSON::ParserError, SocketError, Timeout::Error, Errno::ECONNREFUSED
    raise Error, 'Google token verification failed'
  end

  def validate_payload!(payload, client_ids)
    raise Error, 'Invalid Google token issuer' unless ['accounts.google.com', 'https://accounts.google.com'].include?(payload['iss'])
    raise Error, 'Invalid Google token audience' unless client_ids.include?(payload['aud'])
    raise Error, 'Google email is not verified' unless ActiveModel::Type::Boolean.new.cast(payload['email_verified'])
    raise Error, 'Google account email is missing' if payload['email'].blank?
    raise Error, 'Google account id is missing' if payload['sub'].blank?
  end
end
