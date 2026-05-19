require 'test_helper'

class ApiLeaderboardTest < ActionDispatch::IntegrationTest
  test 'leaderboard includes race progress details for the mobile app' do
    owner = create_user(email: 'leaderboard-owner@example.com')
    runner = create_user(email: 'leaderboard-runner@example.com', gender: 'male')
    tournament = create_tournament(owner, status: 'active')
    first_segment = create_segment(owner, name: 'Leaderboard First')
    second_segment = create_segment(owner, name: 'Leaderboard Second', lng_offset: 0.03)
    tournament.tournament_segments.create!(segment: first_segment, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second_segment, order_number: 2, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))
    TournamentScore.create!(tournament:, user: runner, score: 180, completed_segments_count: 1, rank: 1, gender_rank: 1)
    activity = runner.activities.create!(
      started_at: Time.zone.at(1_800),
      finished_at: Time.zone.at(1_920),
      elapsed_time_seconds: 120,
      source: 'mobile_android'
    )
    effort = SegmentEffort.create!(
      user: runner,
      segment: first_segment,
      activity:,
      elapsed_time_seconds: 120,
      started_at: Time.zone.at(1_800)
    )
    TournamentEventPublisher.segment_unlocked!(tournament:, segment_effort: effort)

    get leaderboard_api_v1_tournament_path(tournament.slug), headers: auth_headers(owner)

    assert_response :success
    leader = response.parsed_body.fetch('items').first
    assert_equal 1, leader['overall_rank']
    assert_equal 1, leader['gender_rank']
    assert_equal 2, leader['rated_segments_count']
    assert_equal 2, leader['next_required_position']
    assert_equal 120, leader['total_time_seconds']
    assert_equal 1, leader['first_opener_bonus_count']
    assert_predicate leader['last_unlock_at'], :present?
    assert_equal 'male', leader.dig('user', 'gender')
  end

  private

  def create_user(email:, role: 'user', gender: 'other')
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      role:,
      gender:
    )
  end

  def create_tournament(user, status: 'draft')
    Tournament.create!(
      name: "Leaderboard Cup #{SecureRandom.hex(4)}",
      description: 'Leaderboard tournament',
      created_by: user,
      total_segments_count: 3,
      rated_segments_count: 2,
      city: 'Kyiv',
      country: 'UA',
      status:
    )
  end

  def create_segment(user, name:, lng_offset: 0.0)
    Segment.create!(
      name:,
      created_by: user,
      is_active: true,
      city: 'Kyiv',
      country: 'UA',
      **segment_geometry(lng_offset:)
    )
  end

  def segment_geometry(lng_offset: 0.0)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    points = [
      factory.point(30.52 + lng_offset, 50.45),
      factory.point(30.53 + lng_offset, 50.46)
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
