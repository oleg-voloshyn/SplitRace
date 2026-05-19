require 'test_helper'

class ApiActivitiesTest < ActionDispatch::IntegrationTest
  test 'activities include completed segment effort details' do
    user = create_user
    segment = create_segment(user)
    activity = user.activities.create!(
      started_at: 20.minutes.ago,
      finished_at: 10.minutes.ago,
      distance_meters: 1_500,
      elapsed_time_seconds: 600,
      source: 'mobile_android'
    )
    SegmentEffort.create!(
      user:,
      segment:,
      activity:,
      elapsed_time_seconds: 300,
      started_at: 18.minutes.ago
    )

    get api_v1_activities_path, headers: auth_headers(user)

    assert_response :success
    activity = response.parsed_body.fetch('items').first
    assert_equal 1, activity['segment_efforts_count']
    assert_equal 'Riverside Sprint', activity['segment_efforts'].first.dig('segment', 'name')
    assert_equal '05:00', activity['segment_efforts'].first['formatted_time']
  end

  test 'activity create stores suspicious GPS signal without rejecting upload' do
    user = create_user

    post api_v1_activities_path,
         params: {
           started_at: Time.zone.at(1_000).iso8601,
           finished_at: Time.zone.at(1_600).iso8601,
           distance_meters: 10_000,
           elapsed_time_seconds: 600,
           source: 'mobile_android',
           gps_points: [
             { lat: 50.45, lng: 30.52, ts: 1_000, accuracy: 5 },
             { lat: 50.46, lng: 30.53, ts: 1_001, accuracy: 75 },
             { lat: 50.90, lng: 30.90, ts: 1_002, accuracy: 80 },
             { lat: 50.91, lng: 30.91, ts: 1_003, accuracy: 85 }
           ]
         },
         headers: auth_headers(user)

    assert_response :created
    body = response.parsed_body
    assert_equal true, body['suspicious']

    activity = user.activities.order(:created_at).last
    assert_predicate activity, :suspicious?
    codes = activity.suspicious_reasons.map { |reason| reason.fetch('code') }
    assert_includes codes, 'teleport_jump'
    assert_includes codes, 'too_many_low_accuracy_points'
  end

  private

  def create_user
    User.create!(
      email: 'runner-activity@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      first_name: 'Runner',
      gender: 'other'
    )
  end

  def create_segment(owner)
    Segment.create!(
      name: 'Riverside Sprint',
      created_by: owner,
      is_active: true,
      city: 'Cherkasy',
      country: 'UA',
      **segment_geometry
    )
  end

  def segment_geometry
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    points = [
      factory.point(32.06, 49.44),
      factory.point(32.07, 49.45)
    ]

    {
      start_point: points.first,
      end_point: points.last,
      polyline: factory.multi_line_string([factory.line_string(points)]),
      distance_meters: 1_500
    }
  end

  def auth_headers(user)
    { 'Authorization' => "Bearer #{JwtService.encode(user_id: user.id)}" }
  end
end
