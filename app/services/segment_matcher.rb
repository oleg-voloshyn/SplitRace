class SegmentMatcher
  PROXIMITY_METERS = 30

  def initialize(activity)
    @activity = activity
    @user     = activity.user
  end

  def call
    return if @activity.gps_points.blank?

    @user.tournaments.where(status: 'active').find_each do |tournament|
      match_ordered_for(tournament)
    end
  end

  private

  # For Golden Fever: player must complete rated segments in order 1→2→3…
  # Only check the player's NEXT required segment. If covered, check the next one.
  def match_ordered_for(tournament)
    rated_segments = tournament.tournament_segments
                               .where(is_rated: true)
                               .order(:order_number)
                               .includes(:segment)

    return if rated_segments.empty?

    completed_ids = SegmentEffort
                    .where(user: @user, segment_id: rated_segments.map(&:segment_id))
                    .pluck(:segment_id)
                    .to_set

    rated_segments.each do |ts|
      next if completed_ids.include?(ts.segment_id)

      # This is the next required segment — try to match in this activity
      effort = try_match(ts.segment)
      break unless effort

      completed_ids.add(ts.segment_id)
    end
  end

  def try_match(segment)
    return nil unless segment.start_point && segment.end_point && @activity.gps_track

    near_start = Activity.where(id: @activity.id)
                         .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                                segment.start_point.to_s, PROXIMITY_METERS)
                         .exists?

    near_end = Activity.where(id: @activity.id)
                       .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                              segment.end_point.to_s, PROXIMITY_METERS)
                       .exists?

    return nil unless near_start && near_end

    elapsed, started = interpolate_time(segment)
    return nil unless elapsed&.positive?

    existing = SegmentEffort.find_by(user: @user, segment:, activity: @activity)
    return existing if existing&.elapsed_time_seconds&.<=(elapsed)

    SegmentEffort.find_or_initialize_by(user: @user, segment:, activity: @activity)
                 .tap { |e| e.update!(elapsed_time_seconds: elapsed, started_at: started) }
  end

  def interpolate_time(segment)
    points = @activity.gps_points
    return unless points.size >= 2

    start_idx = closest_point_index(points, segment.start_point)
    end_idx   = closest_point_index(points, segment.end_point)
    return if start_idx.nil? || end_idx.nil?
    return if start_idx >= end_idx

    start_ts = points[start_idx]['ts'].to_f
    end_ts   = points[end_idx]['ts'].to_f
    elapsed  = (end_ts - start_ts).to_i

    [elapsed, Time.zone.at(start_ts)]
  end

  def closest_point_index(points, geo_point)
    target_lat = geo_point.lat
    target_lng = geo_point.lon

    min_dist = Float::INFINITY
    min_idx  = nil

    points.each_with_index do |pt, i|
      dist = haversine(pt['lat'].to_f, pt['lng'].to_f, target_lat, target_lng)
      if dist < min_dist
        min_dist = dist
        min_idx  = i
      end
    end

    min_idx if min_dist <= PROXIMITY_METERS
  end

  def haversine(lat1, lng1, lat2, lng2)
    rad = Math::PI / 180
    dlat = (lat2 - lat1) * rad
    dlng = (lng2 - lng1) * rad
    a = (Math.sin(dlat / 2)**2) +
        (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (Math.sin(dlng / 2)**2))
    6_371_000 * 2 * Math.asin(Math.sqrt(a))
  end
end
