class TournamentParticipant < ApplicationRecord
  belongs_to :user
  belongs_to :tournament

  validates :joined_at, presence: true
  before_validation { self.joined_at ||= Time.current }
end
