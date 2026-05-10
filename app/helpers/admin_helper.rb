module AdminHelper
  def segment_waypoints_json(segment)
    return "[]" unless segment.polyline
    line = segment.polyline.geometry_n(0)
    (0...line.num_points).map { |i|
      pt = line.point_n(i)
      { lat: pt.latitude, lng: pt.longitude }
    }.to_json
  rescue
    "[]"
  end
end
