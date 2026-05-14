class CheatingReport < ApplicationRecord
  STATUSES = %w[pending dismissed upheld].freeze

  belongs_to :reporter,      class_name: 'User'
  belongs_to :reported_user, class_name: 'User'
  belongs_to :tournament
  belongs_to :reviewed_by, class_name: 'User', optional: true

  validates :reason, presence: true, length: { minimum: 10, maximum: 1000 }
  validates :status, inclusion: { in: STATUSES }
  validates :reporter_id,
            uniqueness: {
              scope: [:reported_user_id, :tournament_id],
              message: 'you have already reported this user in this tournament'
            }
  validate :cannot_report_self

  scope :pending,    -> { where(status: 'pending') }
  scope :reviewed,   -> { where.not(status: 'pending') }
  scope :for_admin,  -> { order(created_at: :desc).includes(:reporter, :reported_user, :tournament) }

  def mark_reviewed!(admin, new_status, notes = nil)
    update!(status: new_status, admin_notes: notes, reviewed_by: admin, reviewed_at: Time.current)
  end

  private

  def cannot_report_self
    errors.add(:reported_user_id, 'you cannot report yourself') if reporter_id.present? && reporter_id == reported_user_id
  end
end
