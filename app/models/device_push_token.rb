class DevicePushToken < ApplicationRecord
  PLATFORMS = %w[android ios].freeze
  TOKEN_FORMAT = /\A(?:Expo|Exponent)PushToken\[[^\]]+\]\z/

  belongs_to :user

  validates :token, presence: true, uniqueness: true, format: { with: TOKEN_FORMAT }
  validates :platform, inclusion: { in: PLATFORMS }

  scope :active, -> { where(disabled_at: nil) }

  def disable!
    update!(disabled_at: Time.current)
  end
end
