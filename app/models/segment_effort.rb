class SegmentEffort < ApplicationRecord
  belongs_to :user
  belongs_to :segment
  belongs_to :activity
  has_many :tournament_events, dependent: :nullify
  has_many :tournament_segment_unlocks, dependent: :destroy

  validates :elapsed_time_seconds, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :started_at, presence: true

  before_save :calculate_pace

  scope :in_tournament_window, lambda { |tournament, participant|
    relation = all

    if (window_start = SegmentEffort.tournament_window_start(tournament, participant))
      relation = relation.where('segment_efforts.started_at >= ?', window_start)
    end

    if tournament.ends_at
      relation = relation.where('segment_efforts.started_at < ?', tournament.ends_at)
    end

    relation
  }

  def self.tournament_window_start(tournament, participant)
    [tournament.starts_at, participant&.joined_at].compact.max
  end

  def self.started_in_tournament_window?(tournament, participant, started_at)
    return false unless started_at

    if (window_start = tournament_window_start(tournament, participant))
      return false if started_at < window_start
    end

    return false if tournament.ends_at && started_at >= tournament.ends_at

    true
  end

  def formatted_time
    hours   = elapsed_time_seconds / 3600
    minutes = (elapsed_time_seconds % 3600) / 60
    seconds = elapsed_time_seconds % 60
    if hours.positive?
      return format('%<hours>02d:%<minutes>02d:%<seconds>02d', hours:, minutes:, seconds:)
    end

    format('%<minutes>02d:%<seconds>02d', minutes:, seconds:)
  end

  private

  def calculate_pace
    return unless elapsed_time_seconds && segment&.distance_meters&.positive?

    self.pace_per_km = (elapsed_time_seconds / 60.0) / (segment.distance_meters / 1000.0)
  end
end
