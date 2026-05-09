class OauthIdentity < ApplicationRecord
  belongs_to :user

  PROVIDERS = %w[google_oauth2 apple strava garmin].freeze

  validates :provider, inclusion: { in: PROVIDERS }
  validates :uid, presence: true
  validates :uid, uniqueness: { scope: :provider }

  def token_expired?
    token_expires_at.present? && Time.current >= token_expires_at
  end
end
