class SegmentResource
  include Alba::Resource

  attributes :id, :name, :distance_meters, :elevation_gain, :city, :country, :created_by_id

  attribute :description, &:description_html

  attribute :start_point, if: proc { params[:detailed] } do |s|
    GeoFormatter.point(s.start_point)
  end

  attribute :end_point, if: proc { params[:detailed] } do |s|
    GeoFormatter.point(s.end_point)
  end

  attribute :polyline, if: proc { params[:detailed] } do |s|
    GeoFormatter.polyline(s.polyline) || []
  end

  attribute :best_effort, if: proc { params[:detailed] } do |segment|
    effort = segment.best_effort_for(params[:current_user])
    if effort
      {
        elapsed_time_seconds: effort.elapsed_time_seconds,
        formatted_time: effort.formatted_time,
        pace_per_km: effort.pace_per_km,
        started_at: effort.started_at
      }
    end
  end
end
