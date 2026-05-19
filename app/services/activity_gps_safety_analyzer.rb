class ActivityGpsSafetyAnalyzer
  MIN_GPS_POINTS = 4
  POOR_ACCURACY_METERS = Activity::GPS_MATCHING_ACCURACY_METERS
  MAX_POOR_ACCURACY_RATIO = 0.4
  MAX_AVERAGE_SPEED_MPS = 8.5
  MAX_POINT_SPEED_MPS = 12.0
  TELEPORT_JUMP_METERS = 300.0
  TELEPORT_WINDOW_SECONDS = 10

  Result = Struct.new(:suspicious, :reasons, :metrics, keyword_init: true) do
    def suspicious? = suspicious
  end

  def self.call(activity:, points:)
    new(activity:, points:).call
  end

  def initialize(activity:, points:)
    @activity = activity
    @points = normalize(points)
  end

  def call
    reasons = []
    metrics = { point_count: points.size }

    add_too_few_points_reason(reasons) if points.size < MIN_GPS_POINTS
    add_accuracy_metrics(metrics, reasons)
    add_average_speed_metrics(metrics, reasons)
    add_point_movement_metrics(metrics, reasons)

    Result.new(suspicious: reasons.any?, reasons:, metrics:)
  end

  private

  attr_reader :activity, :points

  def normalize(raw_points)
    Array(raw_points).filter_map do |point|
      lat = value_for(point, 'lat')
      lng = value_for(point, 'lng')
      next unless lat && lng

      {
        lat: lat.to_f,
        lng: lng.to_f,
        ts: value_for(point, 'ts')&.to_i,
        accuracy: value_for(point, 'accuracy')&.to_f
      }
    end
  end

  def add_too_few_points_reason(reasons)
    reasons << reason(
      'too_few_gps_points',
      "GPS track has fewer than #{MIN_GPS_POINTS} points.",
      value: points.size,
      threshold: MIN_GPS_POINTS
    )
  end

  def add_accuracy_metrics(metrics, reasons)
    accuracy_values = points.filter_map { |point| point[:accuracy].presence }
    poor_count = accuracy_values.count { |accuracy| accuracy > POOR_ACCURACY_METERS }
    poor_ratio = accuracy_values.empty? ? 0.0 : poor_count.to_f / accuracy_values.size

    metrics[:accuracy_points] = accuracy_values.size
    metrics[:poor_accuracy_points] = poor_count
    metrics[:poor_accuracy_ratio] = poor_ratio.round(3)

    return unless poor_count.positive? && poor_ratio >= MAX_POOR_ACCURACY_RATIO

    reasons << reason(
      'too_many_low_accuracy_points',
      "Too many GPS points have accuracy worse than #{POOR_ACCURACY_METERS.to_i}m.",
      value: poor_ratio.round(3),
      threshold: MAX_POOR_ACCURACY_RATIO
    )
  end

  def add_average_speed_metrics(metrics, reasons)
    return unless activity.distance_meters.to_f.positive? && activity.elapsed_time_seconds.to_i.positive?

    average_speed = activity.distance_meters.to_f / activity.elapsed_time_seconds.to_i
    metrics[:average_speed_mps] = average_speed.round(2)

    return unless average_speed > MAX_AVERAGE_SPEED_MPS

    reasons << reason(
      'unrealistic_average_speed',
      'Activity average speed is above the running safety threshold.',
      value: average_speed.round(2),
      threshold: MAX_AVERAGE_SPEED_MPS
    )
  end

  def add_point_movement_metrics(metrics, reasons)
    max_speed = 0.0
    max_jump = 0.0
    non_monotonic_timestamps = 0
    unrealistic_speed = nil
    teleport_jump = nil

    points.each_cons(2) do |previous, current|
      delta_seconds = current[:ts].to_i - previous[:ts].to_i
      if delta_seconds <= 0
        non_monotonic_timestamps += 1
        next
      end

      distance = distance_meters(previous, current)
      speed = distance / delta_seconds
      max_speed = [max_speed, speed].max
      max_jump = [max_jump, distance].max

      unrealistic_speed ||= speed if speed > MAX_POINT_SPEED_MPS
      if distance > TELEPORT_JUMP_METERS && delta_seconds <= TELEPORT_WINDOW_SECONDS
        teleport_jump ||= { distance:, delta_seconds: }
      end
    end

    metrics[:max_point_speed_mps] = max_speed.round(2)
    metrics[:max_jump_meters] = max_jump.round(1)
    metrics[:non_monotonic_timestamps] = non_monotonic_timestamps

    if unrealistic_speed
      reasons << reason(
        'unrealistic_point_speed',
        'GPS points imply an unrealistic speed between consecutive samples.',
        value: unrealistic_speed.round(2),
        threshold: MAX_POINT_SPEED_MPS
      )
    end

    return unless teleport_jump

    reasons << reason(
      'teleport_jump',
      'GPS points jump too far in too little time.',
      value: teleport_jump[:distance].round(1),
      threshold: TELEPORT_JUMP_METERS
    )
  end

  def distance_meters(first, second)
    lat1 = radians(first[:lat])
    lat2 = radians(second[:lat])
    delta_lat = radians(second[:lat] - first[:lat])
    delta_lng = radians(second[:lng] - first[:lng])
    a = (Math.sin(delta_lat / 2)**2) +
        (Math.cos(lat1) * Math.cos(lat2) * (Math.sin(delta_lng / 2)**2))
    6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  end

  def radians(value)
    value.to_f * Math::PI / 180.0
  end

  def value_for(point, key)
    point[key] || point[key.to_sym]
  end

  def reason(code, message, value:, threshold:)
    {
      code:,
      message:,
      value:,
      threshold:
    }
  end
end
