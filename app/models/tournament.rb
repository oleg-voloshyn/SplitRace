class Tournament < ApplicationRecord
  include SanitizesRichTextDescription

  belongs_to :created_by, class_name: 'User'
  has_many :tournament_segments, dependent: :destroy
  has_many :segments, through: :tournament_segments
  has_many :tournament_participants, dependent: :destroy
  has_many :users, through: :tournament_participants
  has_many :tournament_scores, dependent: :destroy

  STATUSES       = %w[draft active completed].freeze
  SCORING_TYPES  = %w[golden_fever].freeze

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :status, inclusion: { in: STATUSES }
  validates :scoring_type, inclusion: { in: SCORING_TYPES }
  validates :total_segments_count, :rated_segments_count, presence: true,
                                                          numericality: { only_integer: true, greater_than: 0 }
  validate  :rated_count_within_total

  before_validation :generate_slug, if: -> { slug.blank? && name.present? }

  scope :active,    -> { where(status: 'active') }
  scope :completed, -> { where(status: 'completed') }
  scope :visible,   -> { where(status: %w[active completed]) }

  def activate!   = update!(status: 'active')
  def complete!   = update!(status: 'completed').tap { recalculate_scores! }

  def participant_for(user) = tournament_participants.find_by(user:)
  def participating?(user)  = tournament_participants.exists?(user:)

  def to_param = slug

  def recalculate_scores!
    TournamentScore.recalculate_all(self)
  end

  private

  def generate_slug
    base = name.parameterize
    candidate = base
    n = 2
    while Tournament.where(slug: candidate).where.not(id:).exists?
      candidate = "#{base}-#{n}"
      n += 1
    end
    self.slug = candidate
  end

  def rated_count_within_total
    return unless rated_segments_count && total_segments_count

    if rated_segments_count >= total_segments_count
      errors.add(:rated_segments_count, 'must be less than total segments count (not equal)')
    end
  end
end
