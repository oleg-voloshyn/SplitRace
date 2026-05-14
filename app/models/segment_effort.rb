class SegmentEffort < ApplicationRecord
  belongs_to :user
  belongs_to :segment
  belongs_to :activity
  has_many :tournament_events, dependent: :nullify

  validates :elapsed_time_seconds, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :started_at, presence: true

  before_save :calculate_pace

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
