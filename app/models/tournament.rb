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
