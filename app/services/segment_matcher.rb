class SegmentMatcher
  LONG_SEGMENT_PROXIMITY_METERS = 30
  SHORT_SEGMENT_PROXIMITY_METERS = 20
  LONG_SEGMENT_ROUTE_CORRIDOR_METERS = 30
  SHORT_SEGMENT_ROUTE_CORRIDOR_METERS = 20
  MIN_GPS_TOLERANCE_METERS = 10
  GPS_ACCURACY_PADDING_METERS = 5
  ROUTE_SAMPLE_METERS = 20
  MIN_ROUTE_COVERAGE = 0.75
  SHORT_SEGMENT_DISTANCE_METERS = 800
  MIN_SHORT_SEGMENT_GPS_POINTS = 4
  MIN_SEGMENT_GPS_POINTS = 4
  MIN_SEGMENT_ACTIVITY_DISTANCE_RATIO = 0.75
  MIN_SEGMENT_ACTIVITY_DURATION_SECONDS = 30
  PROGRESS_BACKTRACK_TOLERANCE_METERS = 20

  def initialize(activity)
    @activity = activity
    @user     = activity.user
    @gps_points = activity.gps_points_for_matching
    @score_changed_tournament_ids = Set.new
    @changed_segment_effort_ids = Set.new
  end

  def call
    return [] if @activity.gps_match_rejected?
    return [] if gps_points.blank?

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
    @score_changed_tournament_ids.to_a
  end

  private

  def passing_segment_ids(tournament)
    tournament.tournament_segments.includes(:segment).filter_map do |ts|
      passes_through?(ts.segment) ? ts.segment_id : nil
    end
  end

  def passes_through?(segment)
    return false unless segment.start_point && segment.end_point && @activity.gps_track

    proximity = proximity_tolerance_for(segment)
    near_start = Activity.where(id: @activity.id)
                         .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                                segment.start_point.to_s, proximity)
                         .exists?
    return false unless near_start

    near_end = Activity.where(id: @activity.id)
                       .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                              segment.end_point.to_s, proximity)
                       .exists?
    return false unless near_end

    start_idx = closest_point_index(gps_points, segment.start_point, tolerance: proximity)
    end_idx   = closest_point_index(gps_points, segment.end_point, tolerance: proximity)
    return false unless enough_gps_points_for_segment?(segment, start_idx:, end_idx:)
    return false unless enough_activity_movement_for_segment?(segment, start_idx:, end_idx:)

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

    # Unlocks are the durable tournament state. Already unlocked segments may
    # be re-run to improve time, but missing positions block all later rated
    # unlocks.
    previous_unlocks = TournamentSegmentUnlock
                       .where(tournament:, user: @user, tournament_segment_id: rated_segments.map(&:id))
                       .index_by(&:segment_id)

    last_new_unlock_at = nil
    rated_segments.each do |ts|
      if (existing_unlock = previous_unlocks[ts.segment_id])
        result = try_match(ts.segment, tournament:, participant:, best_after: existing_unlock.unlocked_at)
        @score_changed_tournament_ids.add(tournament.id) if result&.fetch(:best_improved)
        next
      end

      result = try_match(ts.segment, after: last_new_unlock_at, tournament:, participant:)
      effort = result&.fetch(:effort)
      break unless effort

      unlock = TournamentSegmentUnlock.record!(tournament:, tournament_segment: ts, segment_effort: effort)
      TournamentEventPublisher.segment_unlocked!(unlock:)
      @score_changed_tournament_ids.add(tournament.id)
      previous_unlocks[ts.segment_id] = unlock
      last_new_unlock_at = effort.started_at
    end
  end

  def try_match(segment, after: nil, tournament: nil, participant: nil, best_after: nil)
    return nil unless segment.start_point && segment.end_point && @activity.gps_track

    proximity = proximity_tolerance_for(segment)
    near_start = Activity.where(id: @activity.id)
                         .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                                segment.start_point.to_s, proximity)
                         .exists?

    near_end = Activity.where(id: @activity.id)
                       .where('ST_DWithin(gps_track::geography, ?::geography, ?)',
                              segment.end_point.to_s, proximity)
                       .exists?

    return nil unless near_start && near_end

    start_idx = closest_point_index(gps_points, segment.start_point, tolerance: proximity)
    end_idx   = closest_point_index(gps_points, segment.end_point, tolerance: proximity)
    return nil if start_idx.nil? || end_idx.nil? || start_idx >= end_idx
    return nil unless enough_gps_points_for_segment?(segment, start_idx:, end_idx:)
    return nil unless enough_activity_movement_for_segment?(segment, start_idx:, end_idx:)
    return nil unless follows_route?(segment, start_idx:, end_idx:)

    elapsed, started = interpolate_time(segment)
    return nil unless elapsed&.positive?
    return nil if after && started < after
    if tournament && participant
      return nil unless SegmentEffort.started_in_tournament_window?(tournament, participant, started)
    end

    previous_best = if best_after && tournament && participant
                      best_tournament_effort_for(segment, tournament:, participant:, after: best_after)
                    end

    existing = SegmentEffort.find_by(user: @user, segment:, activity: @activity)
    if existing&.elapsed_time_seconds&.<=(elapsed)
      return {
        effort: existing,
        best_improved: effort_improves_best?(existing, previous_best) &&
          @changed_segment_effort_ids.include?(existing.id)
      }
    end

    effort = SegmentEffort.find_or_initialize_by(user: @user, segment:, activity: @activity)
    best_improved = effort_time_improves_best?(elapsed, previous_best)
    changed = effort.new_record? ||
              effort.elapsed_time_seconds != elapsed ||
              effort.started_at.to_i != started.to_i
    effort.update!(elapsed_time_seconds: elapsed, started_at: started)
    @changed_segment_effort_ids.add(effort.id) if changed
    { effort:, best_improved: }
  end

  def best_tournament_effort_for(segment, tournament:, participant:, after:)
    SegmentEffort
      .in_tournament_window(tournament, participant)
      .where(user: @user, segment:)
      .where('segment_efforts.started_at >= ?', after)
      .where.not(activity_id: @activity.id)
      .order(:elapsed_time_seconds, :started_at, :id)
      .first
  end

  def effort_improves_best?(effort, previous_best)
    previous_best.nil? || effort.elapsed_time_seconds < previous_best.elapsed_time_seconds
  end

  def effort_time_improves_best?(elapsed, previous_best)
    previous_best.nil? || elapsed < previous_best.elapsed_time_seconds
  end

  def activity_overlaps_tournament_window?(tournament, participant)
    if (window_start = SegmentEffort.tournament_window_start(tournament, participant))
      return false if (@activity.finished_at || @activity.started_at) < window_start
    end

    return false if tournament.ends_at && @activity.started_at >= tournament.ends_at

    true
  end

  def interpolate_time(segment)
    points = gps_points
    return unless points.size >= 2

    proximity = proximity_tolerance_for(segment)
    start_idx = closest_point_index(points, segment.start_point, tolerance: proximity)
    end_idx   = closest_point_index(points, segment.end_point, tolerance: proximity)
    return if start_idx.nil? || end_idx.nil?
    return if start_idx >= end_idx

    start_ts = points[start_idx]['ts'].to_f
    end_ts   = points[end_idx]['ts'].to_f
    elapsed  = (end_ts - start_ts).to_i

    [elapsed, Time.zone.at(start_ts)]
  end

  def follows_route?(segment, start_idx:, end_idx:)
    route_points = route_points_for(segment)
    return false if route_points.size < 2

    activity_points = gps_points[start_idx..end_idx]
    return false if activity_points.blank?

    projection = route_projection_for(route_points)
    return false if projection[:total_length].zero?

    matches = route_progress_matches(
      activity_points,
      projection:,
      tolerance: route_corridor_tolerance_for(segment)
    )
    return false if matches.size < minimum_gps_points_for(segment)

    route_progress_coverage(matches, projection[:total_length]) >= MIN_ROUTE_COVERAGE
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

  def closest_point_index(points, geo_point, tolerance:)
    target_lat = geo_point.lat
    target_lng = geo_point.lon

    min_dist = Float::INFINITY
    min_idx  = nil

    points.each_with_index do |pt, i|
      dist = haversine(pt['lat'].to_f, pt['lng'].to_f, target_lat, target_lng)
      next if dist > point_tolerance(pt, tolerance)

      if dist < min_dist
        min_dist = dist
        min_idx  = i
      end
    end

    min_idx
  end

  def enough_gps_points_for_segment?(segment, start_idx:, end_idx:)
    return false if start_idx.nil? || end_idx.nil? || start_idx >= end_idx

    (end_idx - start_idx + 1) >= minimum_gps_points_for(segment)
  end

  def minimum_gps_points_for(segment)
    if segment.distance_meters.to_f < SHORT_SEGMENT_DISTANCE_METERS
      MIN_SHORT_SEGMENT_GPS_POINTS
    else
      MIN_SEGMENT_GPS_POINTS
    end
  end

  def enough_activity_movement_for_segment?(segment, start_idx:, end_idx:)
    return false if start_idx.nil? || end_idx.nil? || start_idx >= end_idx

    activity_points = gps_points[start_idx..end_idx]
    return false if activity_points.blank?

    segment_activity_distance(activity_points) >= minimum_activity_distance_for(segment) &&
      segment_activity_duration(activity_points) >= MIN_SEGMENT_ACTIVITY_DURATION_SECONDS
  end

  def minimum_activity_distance_for(segment)
    segment.distance_meters.to_f * MIN_SEGMENT_ACTIVITY_DISTANCE_RATIO
  end

  def segment_activity_distance(activity_points)
    activity_points.each_cons(2).sum do |from, to|
      haversine(from['lat'].to_f, from['lng'].to_f, to['lat'].to_f, to['lng'].to_f)
    end
  end

  def segment_activity_duration(activity_points)
    activity_points.last['ts'].to_f - activity_points.first['ts'].to_f
  end

  def proximity_tolerance_for(segment)
    if short_segment?(segment)
      SHORT_SEGMENT_PROXIMITY_METERS
    else
      LONG_SEGMENT_PROXIMITY_METERS
    end
  end

  def route_corridor_tolerance_for(segment)
    if short_segment?(segment)
      SHORT_SEGMENT_ROUTE_CORRIDOR_METERS
    else
      LONG_SEGMENT_ROUTE_CORRIDOR_METERS
    end
  end

  def short_segment?(segment)
    segment.distance_meters.to_f < SHORT_SEGMENT_DISTANCE_METERS
  end

  def point_tolerance(point, base_tolerance)
    accuracy = point['accuracy'] || point[:accuracy]
    return base_tolerance unless accuracy.to_f.positive?

    [base_tolerance, [accuracy.to_f + GPS_ACCURACY_PADDING_METERS, MIN_GPS_TOLERANCE_METERS].max].min
  end

  def route_projection_for(route_points)
    total_length = 0.0
    segments = route_points.each_cons(2).filter_map do |from, to|
      length = haversine(from['lat'], from['lng'], to['lat'], to['lng'])
      next unless length.positive?

      segment = { from:, to:, length:, start_measure: total_length }
      total_length += length
      segment
    end

    { segments:, total_length: }
  end

  def route_progress_matches(activity_points, projection:, tolerance:)
    matches = []

    activity_points.each do |point|
      candidates = route_projection_candidates(point, projection, tolerance)
      next if candidates.empty?

      match = next_progress_match(candidates, point, previous: matches.last, tolerance:)
      matches << match if match
    end

    matches
  end

  def next_progress_match(candidates, point, previous:, tolerance:)
    unless previous
      match = candidates.min_by { |candidate| [candidate[:measure], candidate[:distance]] }
      return match.merge(point:)
    end

    actual_move = haversine(previous[:point]['lat'].to_f, previous[:point]['lng'].to_f,
                            point['lat'].to_f, point['lng'].to_f)
    max_progress_jump = actual_move + progress_jump_padding(tolerance)
    eligible = candidates.select do |candidate|
      progress_delta = candidate[:measure] - previous[:measure]
      progress_delta >= -PROGRESS_BACKTRACK_TOLERANCE_METERS &&
        progress_delta <= max_progress_jump
    end

    eligible.min_by { |candidate| [candidate[:distance], candidate[:measure]] }&.merge(point:)
  end

  def route_projection_candidates(point, projection, tolerance)
    projection[:segments].filter_map do |segment|
      candidate = project_point_to_route_segment(point, segment)
      candidate if candidate[:distance] <= point_tolerance(point, tolerance)
    end.sort_by { |candidate| [candidate[:distance], candidate[:measure]] }
  end

  def project_point_to_route_segment(point, segment)
    from = segment[:from]
    to = segment[:to]
    ref_lat = from['lat'].to_f
    meters_per_lat = 111_320.0
    meters_per_lng = meters_per_lat * Math.cos(ref_lat * Math::PI / 180.0)

    px = (point['lng'].to_f - from['lng'].to_f) * meters_per_lng
    py = (point['lat'].to_f - from['lat'].to_f) * meters_per_lat
    sx = (to['lng'].to_f - from['lng'].to_f) * meters_per_lng
    sy = (to['lat'].to_f - from['lat'].to_f) * meters_per_lat
    segment_length_squared = (sx * sx) + (sy * sy)
    ratio = segment_length_squared.positive? ? (((px * sx) + (py * sy)) / segment_length_squared) : 0.0
    ratio = ratio.clamp(0.0, 1.0)
    projected = {
      'lat' => from['lat'].to_f + ((to['lat'].to_f - from['lat'].to_f) * ratio),
      'lng' => from['lng'].to_f + ((to['lng'].to_f - from['lng'].to_f) * ratio)
    }

    {
      distance: haversine(point['lat'].to_f, point['lng'].to_f, projected['lat'], projected['lng']),
      measure: segment[:start_measure] + (segment[:length] * ratio)
    }
  end

  def route_progress_coverage(matches, total_length)
    total_bins = (total_length / ROUTE_SAMPLE_METERS).floor + 1
    return 0.0 if total_bins.zero?

    covered_bins = matches.each_with_object(Set.new) do |match, bins|
      bins << [(match[:measure] / ROUTE_SAMPLE_METERS).floor, total_bins - 1].min
    end
    covered_bins.size.to_f / total_bins
  end

  def progress_jump_padding(tolerance)
    (tolerance * 2) + ROUTE_SAMPLE_METERS
  end

  def haversine(lat1, lng1, lat2, lng2)
    rad = Math::PI / 180
    dlat = (lat2 - lat1) * rad
    dlng = (lng2 - lng1) * rad
    a = (Math.sin(dlat / 2)**2) +
        (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (Math.sin(dlng / 2)**2))
    6_371_000 * 2 * Math.asin(Math.sqrt(a))
  end

  attr_reader :gps_points
end
