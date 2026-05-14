class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :tournament, optional: true
  belongs_to :tournament_event, optional: true

  validates :notification_type, :title, presence: true

  scope :unread, -> { where(read_at: nil) }

  def read? = read_at.present?

  def mark_read!
    update!(read_at: Time.current) unless read?
  end
end
