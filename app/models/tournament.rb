class Tournament < ApplicationRecord
  include SanitizesRichTextDescription

  belongs_to :created_by, class_name: 'User'
  belongs_to :reviewed_by, class_name: 'User', optional: true
  has_many :tournament_segments, dependent: :destroy
  has_many :segments, through: :tournament_segments
  has_many :tournament_participants, dependent: :destroy
  has_many :tournament_events, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :users, through: :tournament_participants
  has_many :tournament_scores, dependent: :destroy
  has_many :cheating_reports, dependent: :destroy

  STATUSES       = %w[draft pending_review active rejected completed].freeze
  SCORING_TYPES  = %w[golden_fever].freeze

  validates :name, presence: true, length: { maximum: 120 }
  validates :description, length: { maximum: 10_000 }, allow_blank: true
  validates :city, :country, length: { maximum: 120 }, allow_blank: true
  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :status, inclusion: { in: STATUSES }
  validates :scoring_type, inclusion: { in: SCORING_TYPES }
  validates :total_segments_count, :rated_segments_count, presence: true,
                                                          numericality: { only_integer: true,
                                                                          greater_than: 0,
                                                                          less_than_or_equal_to: 100 }
  validate  :rated_count_within_total

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  scope :active,    -> { where(status: 'active') }
  scope :completed, -> { where(status: 'completed') }
  scope :pending_review, -> { where(status: 'pending_review') }
  scope :visible, -> { where(status: %w[active completed]) }

  def submit_for_review! = update!(status: 'pending_review', submitted_for_review_at: Time.current, review_note: nil)

  def approve!(admin)
    update!(status: 'active', reviewed_by: admin, reviewed_at: Time.current, review_note: nil)
  end

  def reject!(admin, note = nil)
    update!(status: 'rejected', reviewed_by: admin, reviewed_at: Time.current, review_note: note)
  end

  def activate!   = approve!(reviewed_by)
  def complete!   = update!(status: 'completed').tap { recalculate_scores! }

  def participant_for(user) = tournament_participants.find_by(user:)
  def participating?(user)  = tournament_participants.exists?(user:)

  def to_param = slug

  def recalculate_scores!
    TournamentScore.recalculate_all(self)
  end

  def ready_for_review?
    tournament_segments.count == total_segments_count &&
      tournament_segments.where(is_rated: true).count == rated_segments_count
  end

  private

  CYRILLIC_TRANSLITERATION = {
    'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'h', 'ґ' => 'g', 'д' => 'd',
    'е' => 'e', 'є' => 'ye', 'ж' => 'zh', 'з' => 'z', 'и' => 'y', 'і' => 'i',
    'ї' => 'yi', 'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
    'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't', 'у' => 'u',
    'ф' => 'f', 'х' => 'kh', 'ц' => 'ts', 'ч' => 'ch', 'ш' => 'sh', 'щ' => 'shch',
    'ь' => '', 'ю' => 'yu', 'я' => 'ya', 'ы' => 'y', 'э' => 'e', 'ё' => 'yo',
    'ъ' => ''
  }.freeze

  def generate_slug
    # `parameterize` drops non-Latin characters silently, so a Cyrillic name
    # would yield an empty slug. Transliterate first, then fall back to a
    # random token if there's still nothing usable (e.g. emoji-only name).
    base = transliterate_to_latin(name).parameterize
    base = "tournament-#{SecureRandom.hex(4)}" if base.blank?

    candidate = base
    n = 2
    while Tournament.where(slug: candidate).where.not(id:).exists?
      candidate = "#{base}-#{n}"
      n += 1
    end
    self.slug = candidate
  end

  def transliterate_to_latin(string)
    string.to_s.chars.map { |ch| CYRILLIC_TRANSLITERATION[ch.downcase] || ch }.join
  end

  def rated_count_within_total
    return unless rated_segments_count && total_segments_count

    if rated_segments_count >= total_segments_count
      errors.add(:rated_segments_count, 'must be less than total segments count (not equal)')
    end
  end
end
