class Segment < ApplicationRecord
  include SanitizesRichTextDescription

  belongs_to :created_by, class_name: "User"
  has_many :tournament_segments, dependent: :destroy
  has_many :tournaments, through: :tournament_segments
  has_many :segment_efforts, dependent: :destroy

  validates :name, presence: true
  validates :distance_meters, numericality: { greater_than: 0 }, allow_nil: true

  scope :active, -> { where(is_active: true) }

  def best_effort_for(user)
    segment_efforts.where(user: user).order(elapsed_time_seconds: :asc).first
  end
end
