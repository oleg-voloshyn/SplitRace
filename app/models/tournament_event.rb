class TournamentEvent < ApplicationRecord
  belongs_to :tournament
  belongs_to :actor, class_name: 'User'
  belongs_to :segment, optional: true
  belongs_to :segment_effort, optional: true

  has_many :notifications, dependent: :destroy

  EVENT_TYPES = %w[segment_unlocked].freeze

  validates :event_type, inclusion: { in: EVENT_TYPES }
  validates :title, presence: true
end
