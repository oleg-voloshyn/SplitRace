class Tournament < ApplicationRecord
  include AASM
  include SanitizesRichTextDescription
  extend FriendlyId

  friendly_id :name, use: :slugged

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

  SCORING_TYPES = %w[golden_fever].freeze

  validates :name, presence: true, length: { maximum: 120 }
  validates :description, length: { maximum: 10_000 }, allow_blank: true
  validates :city, :country, length: { maximum: 120 }, allow_blank: true
  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :scoring_type, inclusion: { in: SCORING_TYPES }
  validates :total_segments_count, :rated_segments_count, presence: true,
                                                          numericality: { only_integer: true,
                                                                          greater_than: 0,
                                                                          less_than_or_equal_to: 100 }
  validate  :rated_count_within_total

  aasm column: :status, whiny_persistence: true do
    state :draft, initial: true
    state :pending_review, :active, :rejected, :completed

    event :submit_for_review, before: :record_submission do
      transitions from: %i[draft rejected], to: :pending_review, guard: :ready_for_review?
    end

    event :approve, before: :record_admin_review do
      transitions from: :pending_review, to: :active
    end

    event :reject, before: :record_admin_review do
      transitions from: :pending_review, to: :rejected
    end

    # Moderator override: skips the pending_review step entirely (e.g. for
    # admin-created tournaments) or re-activates a previously-reviewed one.
    event :activate do
      transitions from: %i[draft pending_review rejected], to: :active
    end

    event :complete, after: :recalculate_scores! do
      transitions from: :active, to: :completed
    end
  end

  scope :visible, -> { where(status: %w[active completed]) }

  def participant_for(user) = tournament_participants.find_by(user:)
  def participating?(user)  = tournament_participants.exists?(user:)

  def editable? = draft? || rejected?

  def recalculate_scores!
    TournamentScore.recalculate_all(self)
  end

  def ready_for_review?
    tournament_segments.count == total_segments_count &&
      tournament_segments.where(is_rated: true).count == rated_segments_count
  end

  def normalize_friendly_id(value)
    slug = value.to_s.to_slug.transliterate(:ukrainian, :russian).normalize.to_s.gsub(/[^a-z0-9-]/, '')
    slug.presence || "tournament-#{SecureRandom.hex(4)}"
  end

  private

  def record_submission
    self.submitted_for_review_at = Time.current
    self.review_note = nil
  end

  def record_admin_review(admin, note = nil)
    self.reviewed_by = admin
    self.reviewed_at = Time.current
    self.review_note = note
  end

  def rated_count_within_total
    return unless rated_segments_count && total_segments_count

    if rated_segments_count >= total_segments_count
      errors.add(:rated_segments_count, 'must be less than total segments count (not equal)')
    end
  end
end
