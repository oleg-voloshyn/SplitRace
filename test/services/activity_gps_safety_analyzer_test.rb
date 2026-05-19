require 'test_helper'

class ActivityGpsSafetyAnalyzerTest < ActiveSupport::TestCase
  test 'flags unrealistic speed teleport jumps and poor GPS accuracy' do
    activity = Activity.new(distance_meters: 10_000, elapsed_time_seconds: 600)
    points = [
      { 'lat' => 50.45, 'lng' => 30.52, 'ts' => 1_000, 'accuracy' => 5 },
      { 'lat' => 50.46, 'lng' => 30.53, 'ts' => 1_001, 'accuracy' => 75 },
      { 'lat' => 50.90, 'lng' => 30.90, 'ts' => 1_002, 'accuracy' => 80 },
      { 'lat' => 50.91, 'lng' => 30.91, 'ts' => 1_003, 'accuracy' => 85 }
    ]

    result = ActivityGpsSafetyAnalyzer.call(activity:, points:)
    codes = result.reasons.map { |reason| reason.fetch(:code) }

    assert_predicate result, :suspicious
    assert_includes codes, 'unrealistic_average_speed'
    assert_includes codes, 'unrealistic_point_speed'
    assert_includes codes, 'teleport_jump'
    assert_includes codes, 'too_many_low_accuracy_points'
    assert_operator result.metrics.fetch(:max_point_speed_mps), :>, ActivityGpsSafetyAnalyzer::MAX_POINT_SPEED_MPS
  end

  test 'keeps enough accurate points for matching when noisy points are present' do
    points = [
      { 'lat' => 50.45, 'lng' => 30.52, 'ts' => 1_000, 'accuracy' => 5 },
      { 'lat' => 50.46, 'lng' => 30.53, 'ts' => 1_010, 'accuracy' => 75 },
      { 'lat' => 50.47, 'lng' => 30.54, 'ts' => 1_020, 'accuracy' => 6 }
    ]

    matching_points = Activity.gps_points_for_matching(points)

    assert_equal 2, matching_points.size
    assert_equal([5, 6], matching_points.pluck('accuracy'))
  end

  test 'does not use explicitly inaccurate GPS points for matching' do
    points = [
      { 'lat' => 50.45, 'lng' => 30.52, 'ts' => 1_000, 'accuracy' => 90 },
      { 'lat' => 50.46, 'lng' => 30.53, 'ts' => 1_010, 'accuracy' => 75 }
    ]

    assert_empty Activity.gps_points_for_matching(points)
  end
end
