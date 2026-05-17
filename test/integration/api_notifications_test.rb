require 'test_helper'

class ApiNotificationsTest < ActionDispatch::IntegrationTest
  test 'segment unlock creates tournament feed event and participant notifications' do
    owner = create_user(email: 'owner@example.com')
    runner = create_user(email: 'runner@example.com', first_name: 'Runner')
    spectator = create_user(email: 'spectator@example.com')
    tournament = create_tournament(owner)
    segment = create_segment(owner, name: 'Opening Segment')
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner)
    tournament.tournament_participants.create!(user: spectator)
    effort = create_effort(runner, segment)
    delivered_notifications = []
    original_deliver = ExpoPushNotificationService.method(:deliver)

    ExpoPushNotificationService.define_singleton_method(:deliver) do |notification|
      delivered_notifications << notification
    end

    begin
      assert_difference 'TournamentEvent.count', 1 do
        assert_difference 'Notification.count', 1 do
          TournamentEventPublisher.segment_unlocked!(tournament:, segment_effort: effort)
        end
      end
    ensure
      ExpoPushNotificationService.define_singleton_method(:deliver, original_deliver)
    end
    assert_equal 1, delivered_notifications.size
    assert_equal spectator.id, delivered_notifications.first.user_id

    get feed_api_v1_tournament_path(tournament.slug), headers: auth_headers(runner)

    assert_response :success
    feed = response.parsed_body
    assert_equal 'segment_unlocked', feed.first['event_type']
    assert_includes feed.first['title'], 'Opening Segment'

    get api_v1_notifications_path, headers: auth_headers(spectator)

    assert_response :success
    body = response.parsed_body
    assert_equal 1, body['unread_count']
    assert_includes body['notifications'].first['title'], 'Opening Segment'
  end

  test 'user can register and unregister expo push token' do
    user = create_user(email: 'push@example.com')
    token = 'ExpoPushToken[test-token]'

    assert_difference 'DevicePushToken.count', 1 do
      post api_v1_push_tokens_path,
           params: { push_token: { token:, platform: 'ios' } },
           headers: auth_headers(user)
    end

    assert_response :success
    push_token = user.device_push_tokens.find_by!(token:)
    assert_equal 'ios', push_token.platform
    assert_nil push_token.disabled_at

    delete api_v1_push_tokens_path,
           params: { token: },
           headers: auth_headers(user)

    assert_response :success
    assert_predicate push_token.reload.disabled_at, :present?
  end

  private

  def create_user(email:, first_name: 'Test', role: 'user')
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      first_name:,
      role:,
      gender: 'other'
    )
  end

  def create_tournament(owner)
    Tournament.create!(
      name: 'Feed Cup',
      description: 'Feed test',
      created_by: owner,
      total_segments_count: 2,
      rated_segments_count: 1,
      city: 'Kyiv',
      country: 'UA',
      status: 'active'
    )
  end

  def create_segment(owner, name:)
    Segment.create!(
      name:,
      created_by: owner,
      is_active: true,
      city: 'Kyiv',
      country: 'UA',
      **segment_geometry
    )
  end

  def create_effort(user, segment)
    activity = user.activities.create!(
      started_at: Time.current,
      finished_at: 5.minutes.from_now,
      distance_meters: 1_500,
      elapsed_time_seconds: 300
    )
    SegmentEffort.create!(user:, segment:, activity:, elapsed_time_seconds: 300, started_at: Time.current)
  end

  def segment_geometry
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    points = [
      factory.point(30.52, 50.45),
      factory.point(30.53, 50.46)
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
