class Activity < ApplicationRecord
  GPS_MATCHING_ACCURACY_METERS = 50.0
  GPS_MATCH_REJECTION_REASON_CODES = %w[
    teleport_jump
    too_many_low_accuracy_points
    unrealistic_average_speed
    unrealistic_point_speed
  ].freeze

  belongs_to :user
  has_many :segment_efforts, dependent: :destroy

  SOURCES = %w[web_pwa mobile mobile_android mobile_ios strava_import garmin_import].freeze

  scope :suspicious, -> { where(suspicious: true) }

  validates :started_at, presence: true
  validates :source, inclusion: { in: SOURCES }
  validates :elapsed_time_seconds, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  def duration
    return nil unless started_at && finished_at

    finished_at - started_at
  end

  def gps_points_for_matching
    self.class.gps_points_for_matching(gps_points)
  end

  def gps_match_rejected?
    Array(suspicious_reasons).any? do |reason|
      GPS_MATCH_REJECTION_REASON_CODES.include?(reason['code'] || reason[:code])
    end
  end

  def self.gps_points_for_matching(points)
    points = Array(points)
    accurate_points = points.select { |point| gps_accuracy_usable?(point) }
    has_accuracy_data = points.any? { |point| gps_accuracy_value(point).to_f.positive? }
    return points unless has_accuracy_data

    accurate_points.size >= 2 ? accurate_points : []
  end

  def self.gps_accuracy_usable?(point)
    accuracy = gps_accuracy_value(point)
    return true if accuracy.blank? || accuracy.to_f <= 0

    accuracy.to_f <= GPS_MATCHING_ACCURACY_METERS
  end

  def self.gps_accuracy_value(point)
    point['accuracy'] || point[:accuracy]
  end
end
