require 'net/http'

class ExpoPushNotificationService
  EXPO_PUSH_URL = URI('https://exp.host/--/api/v2/push/send')

  def self.deliver(notification)
    new(notification).deliver
  end

  def initialize(notification)
    @notification = notification
  end

  def deliver
    tokens = notification.user.device_push_tokens.active.to_a
    return if tokens.empty?

    response = Net::HTTP.post(
      EXPO_PUSH_URL,
      messages(tokens).to_json,
      'Content-Type' => 'application/json',
      'Accept' => 'application/json'
    )

    handle_response(response, tokens)
  rescue => e
    Rails.logger.warn("Expo push delivery failed for notification #{notification.id}: #{e.class} #{e.message}")
  end

  private

  attr_reader :notification

  def messages(tokens)
    tokens.map do |push_token|
      {
        to: push_token.token,
        sound: 'default',
        title: notification.title,
        body: notification.body.to_s,
        data: {
          notification_id: notification.id,
          notification_type: notification.notification_type,
          tournament_id: notification.tournament_id,
          tournament_slug: notification.tournament&.slug
        }.compact
      }
    end
  end

  def handle_response(response, tokens)
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.warn("Expo push delivery returned HTTP #{response.code}: #{response.body}")
      return
    end

    payload = JSON.parse(response.body)
    Array(payload['data']).each_with_index do |ticket, index|
      next unless ticket['status'] == 'error'

      Rails.logger.warn("Expo push ticket error: #{ticket['message']}")
      tokens[index]&.disable! if ticket.dig('details', 'error') == 'DeviceNotRegistered'
    end
  rescue JSON::ParserError => e
    Rails.logger.warn("Expo push delivery returned invalid JSON: #{e.message}")
  end
end
