require 'test_helper'

class SegmentRouteMatchingTest < ActionDispatch::IntegrationTest
  ROUTE = [
    [50.4500, 30.5200],
    [50.4510, 30.5200],
    [50.4510, 30.5220],
    [50.4500, 30.5220],
    [50.4500, 30.5206]
  ].freeze

  test 'does not unlock segment when runner cuts from start to finish off the route line' do
    owner = create_user(email: 'route-cut-owner@example.com')
    runner = create_user(email: 'route-cut-runner@example.com')
    tournament = create_tournament(owner)
    segment = create_segment_from_coords(owner, name: 'Around Building', coords: ROUTE)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))

    assert_no_difference 'SegmentEffort.count' do
      assert_no_difference 'TournamentSegmentUnlock.count' do
        assert_no_difference 'TournamentEvent.count' do
          post api_v1_activities_path,
               params: {
                 started_at: Time.zone.at(1_800).iso8601,
                 finished_at: Time.zone.at(1_900).iso8601,
                 distance_meters: 70,
                 elapsed_time_seconds: 100,
                 source: 'mobile_android',
                 gps_points: [
                   { lat: 50.4500, lng: 30.5200, ts: 1_800, accuracy: 5 },
                   { lat: 50.4500, lng: 30.5206, ts: 1_900, accuracy: 5 }
                 ]
               },
               headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    assert_equal 0, response.parsed_body['segment_efforts_count']
    assert_empty TournamentEvent.where(tournament:)
  end

  test 'unlocks segment when runner follows the route line' do
    owner = create_user(email: 'route-follow-owner@example.com')
    runner = create_user(email: 'route-follow-runner@example.com')
    tournament = create_tournament(owner)
    segment = create_segment_from_coords(owner, name: 'Around Building', coords: ROUTE)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))

    assert_difference 'SegmentEffort.count', 1 do
      assert_difference 'TournamentSegmentUnlock.count', 1 do
        assert_difference 'TournamentEvent.count', 1 do
          post api_v1_activities_path,
               params: {
                 started_at: Time.zone.at(1_800).iso8601,
                 finished_at: Time.zone.at(2_100).iso8601,
                 distance_meters: 350,
                 elapsed_time_seconds: 300,
                 source: 'mobile_android',
                 gps_points: gps_points_for_route(ROUTE, start_ts: 1_800)
               },
               headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    assert_equal 1, response.parsed_body['segment_efforts_count']
    assert_equal 'Around Building', response.parsed_body.dig('segment_efforts', 0, 'segment', 'name')
  end

  test 'does not unlock segment when matching route has rejected GPS quality' do
    owner = create_user(email: 'route-bad-gps-owner@example.com')
    runner = create_user(email: 'route-bad-gps-runner@example.com')
    tournament = create_tournament(owner)
    segment = create_segment_from_coords(owner, name: 'Noisy Building', coords: ROUTE)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))

    assert_no_difference 'SegmentEffort.count' do
      assert_no_difference 'TournamentSegmentUnlock.count' do
        assert_no_difference 'TournamentEvent.count' do
          post api_v1_activities_path,
               params: {
                 started_at: Time.zone.at(1_800).iso8601,
                 finished_at: Time.zone.at(2_100).iso8601,
                 distance_meters: 350,
                 elapsed_time_seconds: 300,
                 source: 'mobile_android',
                 gps_points: gps_points_for_route(ROUTE, start_ts: 1_800, accuracy: 90)
               },
               headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    body = response.parsed_body
    assert_equal true, body['suspicious']
    assert_equal 0, body['segment_efforts_count']
    assert_includes runner.activities.last.suspicious_reasons.map { |reason| reason.fetch('code') },
                    'too_many_low_accuracy_points'
  end

  test 'does not unlock short segment from sparse start and finish points only' do
    owner = create_user(email: 'route-sparse-owner@example.com')
    runner = create_user(email: 'route-sparse-runner@example.com')
    tournament = create_tournament(owner)
    segment = create_segment_from_coords(owner, name: 'Sparse Short Segment', coords: [[50.45, 30.52], [50.45, 30.526]])
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))

    assert_no_difference 'SegmentEffort.count' do
      assert_no_difference 'TournamentSegmentUnlock.count' do
        assert_no_difference 'TournamentEvent.count' do
          post api_v1_activities_path,
               params: {
                 started_at: Time.zone.at(1_800).iso8601,
                 finished_at: Time.zone.at(1_920).iso8601,
                 distance_meters: 430,
                 elapsed_time_seconds: 120,
                 source: 'mobile_android',
                 gps_points: [
                   { lat: 50.45, lng: 30.52, ts: 1_800, accuracy: 5 },
                   { lat: 50.45, lng: 30.526, ts: 1_920, accuracy: 5 }
                 ]
               },
               headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    assert_equal 0, response.parsed_body['segment_efforts_count']
  end

  private

  def create_user(email:)
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      gender: 'other'
    )
  end

  def create_tournament(owner)
    Tournament.create!(
      name: "Route Cup #{SecureRandom.hex(4)}",
      description: 'Route matching tournament',
      created_by: owner,
      total_segments_count: 2,
      rated_segments_count: 1,
      city: 'Kyiv',
      country: 'UA',
      status: 'active'
    )
  end

  def create_segment_from_coords(user, name:, coords:)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    points = coords.map { |lat, lng| factory.point(lng, lat) }

    Segment.create!(
      name:,
      created_by: user,
      is_active: true,
      city: 'Kyiv',
      country: 'UA',
      start_point: points.first,
      end_point: points.last,
      polyline: factory.multi_line_string([factory.line_string(points)]),
      distance_meters: route_distance(coords)
    )
  end

  def route_distance(coords)
    coords.each_cons(2).sum { |from, to| haversine(from[0], from[1], to[0], to[1]) }.round(2)
  end

  def haversine(lat1, lng1, lat2, lng2)
    rad = Math::PI / 180
    dlat = (lat2 - lat1) * rad
    dlng = (lng2 - lng1) * rad
    a = (Math.sin(dlat / 2)**2) +
        (Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * (Math.sin(dlng / 2)**2))
    6_371_000 * 2 * Math.asin(Math.sqrt(a))
  end

  def gps_points_for_route(coords, start_ts:, accuracy: 5)
    dense_points = []

    coords.each_cons(2) do |from, to|
      dense_points << from if dense_points.empty?
      1.upto(6) do |step|
        ratio = step / 6.0
        dense_points << [
          from[0] + ((to[0] - from[0]) * ratio),
          from[1] + ((to[1] - from[1]) * ratio)
        ]
      end
    end

    dense_points.map.with_index do |(lat, lng), index|
      { lat:, lng:, ts: start_ts + (index * 10), accuracy: }
    end
  end

  def auth_headers(user)
    { 'Authorization' => "Bearer #{JwtService.encode(user_id: user.id)}" }
  end
end
