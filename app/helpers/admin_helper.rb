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

  def format_seconds(secs)
    return "—" if secs.blank? || secs.to_i <= 0
    s = secs.to_i
    h = s / 3600
    m = (s % 3600) / 60
    sec = s % 60
    h > 0 ? format("%d:%02d:%02d", h, m, sec) : format("%d:%02d", m, sec)
  end

  def format_pace(secs, meters)
    return "—" if secs.blank? || meters.blank? || meters.to_f <= 0 || secs.to_i <= 0
    secs_per_km = secs.to_f / meters.to_f * 1000
    m = (secs_per_km / 60).floor
    s = (secs_per_km % 60).round
    format("%d:%02d /km", m, s)
  end
end
