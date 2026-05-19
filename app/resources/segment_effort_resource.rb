class SegmentEffortResource
  include Alba::Resource

  attributes :id, :elapsed_time_seconds, :pace_per_km

  attribute :formatted_time, &:formatted_time

  attribute :segment do |effort|
    {
      id: effort.segment.id,
      name: effort.segment.name,
      distance_meters: effort.segment.distance_meters,
      city: effort.segment.city,
      country: effort.segment.country
    }
  end
end
