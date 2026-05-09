class SegmentMatcher
  PROXIMITY_METERS = 30

  def initialize(activity)
    @activity = activity
    @user     = activity.user
  end

  def call
    return if @activity.gps_points.blank?

    active_segment_ids = active_tournament_segment_ids
    return if active_segment_ids.empty?

    segments = Segment.where(id: active_segment_ids)
    segments.each { |segment| try_match(segment) }
  end

  private

  def active_tournament_segment_ids
    @user.tournaments
      .where(status: "active")
      .joins(:tournament_segments)
      .pluck("tournament_segments.segment_id")
      .uniq
  end

  def try_match(segment)
    return unless segment.start_point && segment.end_point && @activity.gps_track

    # Check if activity passes near start and end of segment (PostGIS spatial query)
    near_start = Activity.where(id: @activity.id)
      .where("ST_DWithin(gps_track::geography, ?::geography, ?)",
             segment.start_point.to_s, PROXIMITY_METERS)
      .exists?

    near_end = Activity.where(id: @activity.id)
      .where("ST_DWithin(gps_track::geography, ?::geography, ?)",
             segment.end_point.to_s, PROXIMITY_METERS)
      .exists?

    return unless near_start && near_end

    elapsed, started = interpolate_time(segment)
    return unless elapsed && elapsed > 0

    existing = SegmentEffort.find_by(user: @user, segment: segment, activity: @activity)
    return if existing && existing.elapsed_time_seconds <= elapsed

    SegmentEffort.find_or_initialize_by(user: @user, segment: segment, activity: @activity)
      .update!(elapsed_time_seconds: elapsed, started_at: started)
  end

  def interpolate_time(segment)
    points = @activity.gps_points
    return unless points.size >= 2

    start_idx = closest_point_index(points, segment.start_point)
    end_idx   = closest_point_index(points, segment.end_point)
    return if start_idx.nil? || end_idx.nil?
    return if start_idx >= end_idx

    start_ts = points[start_idx]["ts"].to_f
    end_ts   = points[end_idx]["ts"].to_f
    elapsed  = (end_ts - start_ts).to_i

    started_at = Time.at(start_ts)
    [elapsed, started_at]
  end

  def closest_point_index(points, geo_point)
    target_lat = geo_point.lat
    target_lng = geo_point.lon

    min_dist = Float::INFINITY
    min_idx  = nil

    points.each_with_index do |pt, i|
      dist = haversine(pt["lat"].to_f, pt["lng"].to_f, target_lat, target_lng)
      if dist < min_dist
        min_dist = dist
        min_idx  = i
      end
    end

    # Only accept if within proximity threshold
    min_idx if min_dist <= PROXIMITY_METERS
  end

  # Haversine distance in meters
  def haversine(lat1, lng1, lat2, lng2)
    rad = Math::PI / 180
    dlat = (lat2 - lat1) * rad
    dlng = (lng2 - lng1) * rad
    a = Math.sin(dlat / 2)**2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dlng / 2)**2
    6_371_000 * 2 * Math.asin(Math.sqrt(a))
  end
end
