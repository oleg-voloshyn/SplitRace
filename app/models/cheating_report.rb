class CheatingReport < ApplicationRecord
  include AASM

  belongs_to :reporter,      class_name: 'User'
  belongs_to :reported_user, class_name: 'User'
  belongs_to :tournament
  belongs_to :reviewed_by, class_name: 'User', optional: true

  validates :reason, presence: true, length: { minimum: 10, maximum: 1000 }
  validates :reporter_id,
            uniqueness: {
              scope: [:reported_user_id, :tournament_id],
              message: 'you have already reported this user in this tournament'
            }
  validate :cannot_report_self

  aasm column: :status, whiny_persistence: true do
    state :pending, initial: true
    state :dismissed, :upheld

    event :dismiss, before: :record_review do
      transitions from: :pending, to: :dismissed
    end

    event :uphold, before: :record_review do
      transitions from: :pending, to: :upheld
    end
  end

  scope :reviewed,  -> { where.not(status: 'pending') }
  scope :for_admin, -> { order(created_at: :desc).includes(:reporter, :reported_user, :tournament) }

  private

  def record_review(admin, notes = nil)
    self.reviewed_by = admin
    self.admin_notes = notes
    self.reviewed_at = Time.current
  end

  def cannot_report_self
    errors.add(:reported_user_id, 'you cannot report yourself') if reporter_id.present? && reporter_id == reported_user_id
  end
end
