class TournamentSegment < ApplicationRecord
  belongs_to :tournament
  belongs_to :segment

  validates :order_number, presence: true, numericality: { only_integer: true, greater_than: 0 }
end
