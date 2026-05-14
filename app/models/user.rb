class User < ApplicationRecord
  has_secure_password validations: false

  has_many :oauth_identities, dependent: :destroy
  has_many :activities, dependent: :destroy
  has_many :segment_efforts, dependent: :destroy
  has_many :tournament_participants, dependent: :destroy
  has_many :tournaments, through: :tournament_participants
  has_many :created_tournaments, class_name: 'Tournament', foreign_key: :created_by_id, inverse_of: :created_by, dependent: :nullify
  has_many :tournament_scores, dependent: :destroy

  GENDERS = %w[male female other].freeze
  ROLES   = %w[user moderator admin].freeze
  UNITS   = %w[km miles].freeze
  LOCALES = %w[en de fr es it].freeze

  validates :email, presence: true, uniqueness: { case_sensitive: false }, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :gender, inclusion: { in: GENDERS }, allow_nil: true
  validates :role,   inclusion: { in: ROLES }
  validates :units,  inclusion: { in: UNITS }
  validates :locale, inclusion: { in: LOCALES }
  validate  :password_or_oauth_required

  before_save { email.downcase! }

  def admin?     = role == 'admin'
  def moderator? = %w[moderator admin].include?(role)
  def full_name  = "#{first_name} #{last_name}".strip.presence || email

  def oauth_identity_for(provider)
    oauth_identities.find_by(provider: provider.to_s)
  end

  private

  def password_or_oauth_required
    return if password_digest.present? || oauth_identities.any?

    errors.add(:base, 'must have a password or OAuth connection')
  end
end
