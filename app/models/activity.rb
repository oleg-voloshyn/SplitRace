class Activity < ApplicationRecord
  belongs_to :user
  has_many :segment_efforts, dependent: :destroy

  SOURCES = %w[web_pwa mobile mobile_android mobile_ios strava_import garmin_import].freeze

  validates :started_at, presence: true
  validates :source, inclusion: { in: SOURCES }
  validates :elapsed_time_seconds, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  def duration
    return nil unless started_at && finished_at
    finished_at - started_at
  end

end
