class SegmentMatcher
  PROXIMITY_METERS = 30
  ROUTE_CORRIDOR_METERS = 30
  ROUTE_SAMPLE_METERS = 20
  MIN_ROUTE_COVERAGE = 0.75

  def initialize(activity)
    @activity = activity
    @user     = activity.user
  end

  def call
    return if @activity.gps_points.blank?

    passed_ids = []

    @user.tournament_participants
         .includes(tournament: { tournament_segments: :segment })
         .joins(:tournament)
         .where(tournaments: { status: 'active' })
         .find_each do |participant|
      tournament = participant.tournament
      next unless activity_overlaps_tournament_window?(tournament, participant)

      match_ordered_for(tournament, participant)
      passed_ids.concat(passing_segment_ids(tournament))
    end

    @activity.update_columns(passed_segment_ids: passed_ids.uniq) if passed_ids.any?
  end

  private

  def passing_segment_ids(tournament)
    tournament.tournament_segments.includes(:segment).filter_map do |ts|
      passes_through?(ts.segment) ? ts.segment_id : nil
    end
  end

  def passes_through?(segment)
    return false unless segment.start_point && segment.end_point && @activity.gps_track

    near_start = Activity.where(id: @activity.id)
                         .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                                segment.start_point.to_s, PROXIMITY_METERS)
                         .exists?
    return false unless near_start

    near_end = Activity.where(id: @activity.id)
                       .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                              segment.end_point.to_s, PROXIMITY_METERS)
                       .exists?
    return false unless near_end

    start_idx = closest_point_index(@activity.gps_points, segment.start_point)
    end_idx   = closest_point_index(@activity.gps_points, segment.end_point)
    !start_idx.nil? && !end_idx.nil? && start_idx < end_idx && follows_route?(segment, start_idx:, end_idx:)
  end

  # Rated segments are unlocked strictly in order for each runner. GPS may pass
  # later rated routes, but they do not count until all earlier rated positions
  # are already unlocked or unlocked earlier in this same activity.
  def match_ordered_for(tournament, participant)
    rated_segments = tournament.tournament_segments
                               .where(is_rated: true)
                               .order(:order_number)
                               .includes(:segment)

    return if rated_segments.empty?

    # Segments the user had efforts for BEFORE this activity. Already unlocked
    # segments may be re-run to improve time, but missing positions block all
    # later rated unlocks.
    previously_completed = TournamentSegmentUnlock
                           .where(tournament:, user: @user, tournament_segment_id: rated_segments.map(&:id))
                           .pluck(:segment_id)
                           .to_set

    last_new_unlock_at = nil
    rated_segments.each do |ts|
      if previously_completed.include?(ts.segment_id)
        try_match(ts.segment, tournament:, participant:)
        next
      end

      effort = try_match(ts.segment, after: last_new_unlock_at, tournament:, participant:)
      break unless effort

      unlock = TournamentSegmentUnlock.record!(tournament:, tournament_segment: ts, segment_effort: effort)
      TournamentEventPublisher.segment_unlocked!(unlock:)
      previously_completed.add(ts.segment_id)
      last_new_unlock_at = effort.started_at
    end
  end

  def try_match(segment, after: nil, tournament: nil, participant: nil)
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

    start_idx = closest_point_index(@activity.gps_points, segment.start_point)
    end_idx   = closest_point_index(@activity.gps_points, segment.end_point)
    return nil if start_idx.nil? || end_idx.nil? || start_idx >= end_idx
    return nil unless follows_route?(segment, start_idx:, end_idx:)

    elapsed, started = interpolate_time(segment)
    return nil unless elapsed&.positive?
    return nil if after && started < after
    if tournament && participant
      return nil unless SegmentEffort.started_in_tournament_window?(tournament, participant, started)
    end

    existing = SegmentEffort.find_by(user: @user, segment:, activity: @activity)
    return existing if existing&.elapsed_time_seconds&.<=(elapsed)

    SegmentEffort.find_or_initialize_by(user: @user, segment:, activity: @activity)
                 .tap { |e| e.update!(elapsed_time_seconds: elapsed, started_at: started) }
  end

  def activity_overlaps_tournament_window?(tournament, participant)
    if (window_start = SegmentEffort.tournament_window_start(tournament, participant))
      return false if (@activity.finished_at || @activity.started_at) < window_start
    end

    return false if tournament.ends_at && @activity.started_at >= tournament.ends_at

    true
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

  def follows_route?(segment, start_idx:, end_idx:)
    route_points = route_points_for(segment)
    return true if route_points.size <= 2

    activity_points = @activity.gps_points[start_idx..end_idx]
    return false if activity_points.blank?

    sampled_route = sample_route(route_points)
    return false if sampled_route.empty?

    matched_count = 0
    search_from = 0

    sampled_route.each do |route_point|
      match_idx = closest_activity_index(activity_points, route_point, from: search_from)
      next unless match_idx

      matched_count += 1
      search_from = match_idx
    end

    (matched_count.to_f / sampled_route.size) >= MIN_ROUTE_COVERAGE
  end

  def route_points_for(segment)
    line = first_line(segment.polyline)
    points = line_points(line)
    return points if points.size >= 2

    [coord_for(segment.start_point), coord_for(segment.end_point)].compact
  end

  def first_line(polyline)
    return unless polyline

    if polyline.respond_to?(:geometry_n)
      polyline.geometry_n(0)
    elsif polyline.respond_to?(:geometries)
      polyline.geometries.first
    else
      polyline
    end
  end

  def line_points(line)
    return [] unless line

    if line.respond_to?(:points)
      line.points.map { |point| coord_for(point) }
    elsif line.respond_to?(:num_points)
      Array.new(line.num_points) { |i| coord_for(line.point_n(i)) }
    else
      []
    end.compact
  end

  def coord_for(point)
    return unless point

    { 'lat' => point.lat.to_f, 'lng' => point.lon.to_f }
  end

  def sample_route(route_points)
    samples = [route_points.first]

    route_points.each_cons(2) do |from, to|
      distance = haversine(from['lat'], from['lng'], to['lat'], to['lng'])
      if distance.positive?
        steps = (distance / ROUTE_SAMPLE_METERS).floor
        1.upto(steps) do |step|
          ratio = [(step * ROUTE_SAMPLE_METERS) / distance, 1.0].min
          samples << {
            'lat' => from['lat'] + ((to['lat'] - from['lat']) * ratio),
            'lng' => from['lng'] + ((to['lng'] - from['lng']) * ratio)
          }
        end
      end
      samples << to
    end

    samples
  end

  def closest_activity_index(activity_points, route_point, from:)
    min_dist = Float::INFINITY
    min_idx = nil

    activity_points.each_with_index do |point, idx|
      next if idx < from

      dist = haversine(point['lat'].to_f, point['lng'].to_f, route_point['lat'], route_point['lng'])
      if dist < min_dist
        min_dist = dist
        min_idx = idx
      end
    end

    min_idx if min_dist <= ROUTE_CORRIDOR_METERS
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
