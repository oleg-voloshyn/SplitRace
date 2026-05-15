class TournamentParticipant < ApplicationRecord
  belongs_to :user
  belongs_to :tournament

  validates :joined_at, presence: true
  validate :user_must_be_runner
  before_validation { self.joined_at ||= Time.current }

  private

  def user_must_be_runner
    errors.add(:user, 'must be a runner') if user&.club?
  end
end
