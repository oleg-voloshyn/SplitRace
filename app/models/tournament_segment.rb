class TournamentSegment < ApplicationRecord
  belongs_to :tournament
  belongs_to :segment

  validates :order_number, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validate :segment_created_by_tournament_owner

  private

  def segment_created_by_tournament_owner
    return unless segment && tournament
    return if segment.created_by_id == tournament.created_by_id

    errors.add(:segment, 'must be created by the tournament owner')
  end
end
