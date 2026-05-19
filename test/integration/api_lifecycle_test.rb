require 'test_helper'

class ApiLifecycleTest < ActionDispatch::IntegrationTest
  test 'register normalizes email and returns auth payload' do
    post api_v1_auth_register_path,
         params: {
           email: 'Runner.Lifecycle@Example.COM',
           password: 'password123',
           password_confirmation: 'password123',
           first_name: 'Lifecycle',
           gender: 'other'
         }

    assert_response :created
    body = response.parsed_body
    assert_predicate body['token'], :present?
    assert_equal 'runner.lifecycle@example.com', body.dig('user', 'email')
    assert_equal 'Lifecycle', body.dig('user', 'display_name')
  end

  test 'club registration requires club name' do
    post api_v1_auth_register_path,
         params: {
           email: 'club-lifecycle@example.com',
           password: 'password123',
           password_confirmation: 'password123',
           account_type: 'club'
         }

    assert_response :unprocessable_content
    assert_includes response.parsed_body['errors'].join, "Club name can't be blank"
  end

  test 'login rejects invalid password' do
    user = create_user(email: 'login-lifecycle@example.com')

    post api_v1_auth_login_path, params: { email: user.email, password: 'wrong-password' }

    assert_response :unauthorized
    assert_equal 'Invalid email or password', response.parsed_body['error']
  end

  test 'google auth creates runner user and oauth identity' do
    payload = {
      'sub' => 'google-runner-1',
      'email' => 'Google.Runner@Example.com',
      'email_verified' => 'true',
      'given_name' => 'Google',
      'family_name' => 'Runner',
      'picture' => 'https://example.com/avatar.png',
      'exp' => 1.hour.from_now.to_i
    }

    assert_difference 'User.count', 1 do
      assert_difference 'OauthIdentity.count', 1 do
        with_google_verifier(payload) do
          post api_v1_auth_google_path, params: { id_token: 'google-id-token' }
        end
      end
    end

    assert_response :success
    user = User.find_by!(email: 'google.runner@example.com')
    assert_equal 'user', user.account_type
    assert_equal 'Google', user.first_name
    assert_equal 'Runner', user.last_name
    assert_equal 'https://example.com/avatar.png', user.avatar_url
    assert_equal 'google_oauth2', user.oauth_identities.first.provider
    assert_predicate response.parsed_body['token'], :present?
  end

  test 'google auth links existing runner by email' do
    user = create_user(email: 'existing-google@example.com')
    payload = {
      'sub' => 'google-runner-existing',
      'email' => user.email,
      'email_verified' => 'true'
    }

    assert_no_difference 'User.count' do
      assert_difference 'OauthIdentity.count', 1 do
        with_google_verifier(payload) do
          post api_v1_auth_google_path, params: { id_token: 'google-id-token' }
        end
      end
    end

    assert_response :success
    assert_equal user.id, OauthIdentity.find_by!(provider: 'google_oauth2', uid: 'google-runner-existing').user_id
  end

  test 'google auth is rejected for club email' do
    club = create_club(email: 'club-google@example.com', club_name: 'Google Club')
    payload = {
      'sub' => 'google-club-1',
      'email' => club.email,
      'email_verified' => 'true'
    }

    assert_no_difference 'OauthIdentity.count' do
      with_google_verifier(payload) do
        post api_v1_auth_google_path, params: { id_token: 'google-id-token' }
      end
    end

    assert_response :unprocessable_content
    assert_includes response.parsed_body['errors'], 'Social sign-in is only available for runners, not clubs'
  end

  test 'protected api endpoints require bearer token' do
    get api_v1_me_path

    assert_response :unauthorized
    assert_equal 'Unauthorized', response.parsed_body['error']
  end

  test 'tournaments index only exposes visible tournaments' do
    owner = create_user(email: 'visible-owner@example.com')
    active = create_tournament(owner, name: 'Active Cup', status: 'active')
    completed = create_tournament(owner, name: 'Completed Cup', status: 'completed')
    create_tournament(owner, name: 'Draft Cup', status: 'draft')
    create_tournament(owner, name: 'Pending Cup', status: 'pending_review')
    viewer = create_user(email: 'visible-viewer@example.com')

    get api_v1_tournaments_path, headers: auth_headers(viewer)

    assert_response :success
    names = response.parsed_body.fetch('items').pluck('name')
    assert_includes names, active.name
    assert_includes names, completed.name
    assert_not_includes names, 'Draft Cup'
    assert_not_includes names, 'Pending Cup'
  end

  test 'user can join active tournament and duplicate join is rejected' do
    owner = create_user(email: 'join-owner@example.com')
    user = create_user(email: 'join-runner@example.com')
    tournament = create_tournament(owner, status: 'active')

    assert_difference 'TournamentParticipant.count', 1 do
      post join_api_v1_tournament_path(tournament.slug), headers: auth_headers(user)
    end
    assert_response :success
    assert_equal true, response.parsed_body['joined']

    assert_no_difference 'TournamentParticipant.count' do
      post join_api_v1_tournament_path(tournament.slug), headers: auth_headers(user)
    end
    assert_response :unprocessable_content
    assert_equal 'Already joined', response.parsed_body['error']
  end

  test 'user cannot join draft tournament' do
    owner = create_user(email: 'draft-owner@example.com')
    user = create_user(email: 'draft-runner@example.com')
    tournament = create_tournament(owner, status: 'draft')

    post join_api_v1_tournament_path(tournament.slug), headers: auth_headers(user)

    assert_response :unprocessable_content
    assert_equal 'Tournament is not active', response.parsed_body['error']
  end

  test 'club cannot participate in active tournament' do
    owner = create_user(email: 'club-participation-owner@example.com')
    club = create_club(
      email: 'club-participation@example.com',
      club_name: 'Lifecycle Running Club'
    )
    tournament = create_tournament(owner, status: 'active')

    assert_no_difference 'TournamentParticipant.count' do
      post join_api_v1_tournament_path(tournament.slug), headers: auth_headers(club)
    end

    assert_response :forbidden
    assert_equal 'Running clubs cannot participate in tournaments', response.parsed_body['error']
    assert_not tournament.tournament_participants.build(user: club).valid?
  end

  test 'user can leave tournament and second leave is rejected' do
    owner = create_user(email: 'leave-owner@example.com')
    user = create_user(email: 'leave-runner@example.com')
    tournament = create_tournament(owner, status: 'active')
    tournament.tournament_participants.create!(user:)

    assert_difference 'TournamentParticipant.count', -1 do
      delete leave_api_v1_tournament_path(tournament.slug), headers: auth_headers(user)
    end
    assert_response :success
    assert_equal true, response.parsed_body['left']

    delete leave_api_v1_tournament_path(tournament.slug), headers: auth_headers(user)

    assert_response :unprocessable_content
    assert_equal 'Not participating', response.parsed_body['error']
  end

  test 'non owner cannot submit tournament for review or add segments' do
    owner = create_user(email: 'owner-only@example.com')
    stranger = create_user(email: 'stranger@example.com')
    tournament = create_tournament(owner, status: 'draft')
    segment = create_segment(stranger, name: 'Stranger Segment')

    post submit_for_review_api_v1_tournament_path(tournament.slug), headers: auth_headers(stranger)

    assert_response :forbidden
    assert_equal 'Forbidden', response.parsed_body['error']

    post add_segment_api_v1_tournament_path(tournament.slug),
         params: { segment_id: segment.id, is_rated: '1', order_number: 1 },
         headers: auth_headers(stranger)

    assert_response :forbidden
    assert_equal 'Forbidden', response.parsed_body['error']
  end

  test 'owner can remove segment and order is normalized' do
    owner = create_user(email: 'remove-owner@example.com')
    tournament = create_tournament(owner, total_segments_count: 4, rated_segments_count: 2)
    first = create_segment(owner, name: 'First')
    second = create_segment(owner, name: 'Second')
    third = create_segment(owner, name: 'Third')
    tournament.tournament_segments.create!(segment: first, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second, order_number: 2, is_rated: true)
    tournament.tournament_segments.create!(segment: third, order_number: 3, is_rated: false)

    assert_difference 'TournamentSegment.count', -1 do
      delete "/api/v1/tournaments/#{tournament.slug}/segments/#{second.id}", headers: auth_headers(owner)
    end

    assert_response :success
    assert_equal [1, 2], tournament.tournament_segments.reload.order(:order_number).pluck(:order_number)
    assert_equal [first.id, third.id], tournament.tournament_segments.order(:order_number).pluck(:segment_id)
  end

  test 'tournament details hide segment order from non owner' do
    owner = create_user(email: 'hidden-order-owner@example.com')
    viewer = create_user(email: 'hidden-order-viewer@example.com')
    tournament = create_tournament(owner, status: 'active', total_segments_count: 3, rated_segments_count: 2)
    first = create_segment(owner, name: 'Alpha Hidden')
    second = create_segment(owner, name: 'Beta Hidden')
    tournament.tournament_segments.create!(segment: second, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: first, order_number: 2, is_rated: false)

    get api_v1_tournament_path(tournament.slug), headers: auth_headers(viewer)

    assert_response :success
    public_segments = response.parsed_body['segments']
    public_segment_names = public_segments.map { |ts| ts.dig('segment', 'name') }
    assert_equal ['Alpha Hidden', 'Beta Hidden'], public_segment_names
    assert(public_segments.all? { |ts| ts['order_number'].nil? })
    assert(public_segments.all? { |ts| ts['is_rated'].nil? })

    get api_v1_tournament_path(tournament.slug), headers: auth_headers(owner)

    assert_response :success
    owner_segments = response.parsed_body['segments']
    assert_equal [1, 2], owner_segments.pluck('order_number')
    assert_equal [true, false], owner_segments.pluck('is_rated')
  end

  test 'leaderboard orders scores and filters by gender' do
    owner = create_user(email: 'leader-owner@example.com')
    female = create_user(email: 'leader-female@example.com', gender: 'female')
    male = create_user(email: 'leader-male@example.com', gender: 'male')
    tournament = create_tournament(owner, status: 'active')
    tournament.tournament_participants.create!(user: female)
    tournament.tournament_participants.create!(user: male)
    TournamentScore.create!(tournament:, user: female, score: 140, completed_segments_count: 1)
    TournamentScore.create!(tournament:, user: male, score: 180, completed_segments_count: 1)

    get leaderboard_api_v1_tournament_path(tournament.slug), headers: auth_headers(owner)

    assert_response :success
    leaderboard = response.parsed_body.fetch('items')
    leaderboard_names = leaderboard.map { |row| row.dig('user', 'full_name') }
    assert_equal ['leader-male@example.com', 'leader-female@example.com'], leaderboard_names
    assert_equal [1, 2], leaderboard.pluck('rank')

    get leaderboard_api_v1_tournament_path(tournament.slug, gender: 'female'), headers: auth_headers(owner)

    assert_response :success
    gender_leaderboard_names = response.parsed_body.fetch('items').map { |row| row.dig('user', 'full_name') }
    assert_equal ['leader-female@example.com'], gender_leaderboard_names
  end

  test 'moderator can activate and complete tournament while regular user cannot' do
    owner = create_user(email: 'moderated-owner@example.com')
    moderator = create_user(email: 'moderator@example.com', role: 'moderator')
    regular = create_user(email: 'regular@example.com')
    tournament = create_tournament(owner, status: 'pending_review')

    patch activate_api_v1_tournament_path(tournament.slug), headers: auth_headers(regular)

    assert_response :forbidden
    assert_equal 'pending_review', tournament.reload.status

    patch activate_api_v1_tournament_path(tournament.slug), headers: auth_headers(moderator)

    assert_response :success
    assert_equal 'active', tournament.reload.status

    patch complete_api_v1_tournament_path(tournament.slug), headers: auth_headers(moderator)

    assert_response :success
    assert_equal 'completed', tournament.reload.status
  end

  test 'notifications can be marked read individually and in bulk' do
    user = create_user(email: 'notify-reader@example.com')
    tournament = create_tournament(user, status: 'active')
    first = create_notification(user, tournament, title: 'First')
    create_notification(user, tournament, title: 'Second')

    get api_v1_notifications_path, headers: auth_headers(user)

    assert_response :success
    assert_equal 2, response.parsed_body['unread_count']

    patch api_v1_read_notification_path(first.id), headers: auth_headers(user)

    assert_response :success
    assert_predicate response.parsed_body['read_at'], :present?

    post api_v1_notifications_read_all_path, headers: auth_headers(user)

    assert_response :success
    assert_equal 0, response.parsed_body['unread_count']
    assert_equal 0, user.notifications.unread.count
  end

  test 'activity creation stores gps points and unlocks matching tournament segment' do
    owner = create_user(email: 'activity-owner@example.com')
    runner = create_user(email: 'activity-runner@example.com')
    tournament = create_tournament(owner, status: 'active')
    segment = create_segment(owner, name: 'Matched Segment')
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))
    gps_points = gps_points_for_segment(lng_offset: 0.0, start_ts: 1_800, end_ts: 1_920)

    assert_difference 'Activity.count', 1 do
      assert_difference 'SegmentEffort.count', 1 do
        post api_v1_activities_path,
             params: {
               started_at: Time.zone.at(1_800).iso8601,
               finished_at: Time.zone.at(1_920).iso8601,
               distance_meters: 1_000,
               elapsed_time_seconds: 120,
               source: 'mobile_android',
               gps_points:
             },
             headers: auth_headers(runner)
      end
    end

    assert_response :created
    body = response.parsed_body
    assert_equal gps_points.size, body['gps_points'].size
    assert_equal 1, body['segment_efforts_count']
    assert_equal 'Matched Segment', body.dig('segment_efforts', 0, 'segment', 'name')
    assert_equal 1, TournamentSegmentUnlock.where(tournament:, segment:).count
    assert_equal 1, TournamentEvent.where(tournament:, segment:).count
    # Actor (runner) does not receive a notification for their own unlock.
    assert_equal 0, runner.notifications.where(tournament:).count
  end

  test 'activity does not treat pre start segment effort as an unlocked tournament segment' do
    owner = create_user(email: 'activity-window-owner@example.com')
    runner = create_user(email: 'activity-window-runner@example.com')
    tournament = create_tournament(
      owner,
      status: 'active',
      total_segments_count: 3,
      rated_segments_count: 2
    )
    tournament.update!(starts_at: Time.zone.at(2_000))
    first = create_segment(owner, name: 'Window First', lng_offset: 0.0)
    second = create_segment(owner, name: 'Window Second', lng_offset: 0.03)
    tournament.tournament_segments.create!(segment: first, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second, order_number: 2, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_900))
    create_effort(user: runner, segment: first, elapsed: 100, started_at: Time.zone.at(1_950))

    assert_no_difference 'SegmentEffort.count' do
      assert_no_difference 'TournamentSegmentUnlock.count' do
        assert_no_difference 'TournamentEvent.count' do
          post api_v1_activities_path,
               params: {
                 started_at: Time.zone.at(2_100).iso8601,
                 finished_at: Time.zone.at(2_220).iso8601,
                 distance_meters: 1_500,
                 elapsed_time_seconds: 120,
                 source: 'mobile_android',
                 gps_points: [
                   { lat: 50.45, lng: 30.55, ts: 2_100, accuracy: 5 },
                   { lat: 50.46, lng: 30.56, ts: 2_220, accuracy: 5 }
                 ]
               },
               headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    assert_equal 0, response.parsed_body['segment_efforts_count']
    assert_equal [{ 'tournament_name' => tournament.name, 'position' => 1 }],
                 response.parsed_body['pending_rated_unlocks']
  end

  test 'activity does not unlock later rated segments before the first missing rated segment' do
    owner = create_user(email: 'activity-later-owner@example.com')
    runner = create_user(email: 'activity-later-runner@example.com')
    spectator = create_user(email: 'activity-later-spectator@example.com')
    tournament = create_tournament(owner, status: 'active', total_segments_count: 4, rated_segments_count: 3)
    skipped = create_segment(owner, name: 'Skipped Rated', lng_offset: 0.0)
    second = create_segment(owner, name: 'Second Rated', lng_offset: 0.03)
    third = create_segment(owner, name: 'Third Rated', lng_offset: 0.06)
    tournament.tournament_segments.create!(segment: skipped, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second, order_number: 2, is_rated: true)
    tournament.tournament_segments.create!(segment: third, order_number: 3, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))
    tournament.tournament_participants.create!(user: spectator, joined_at: Time.zone.at(1_700))

    assert_no_difference 'SegmentEffort.count' do
      assert_no_difference 'TournamentSegmentUnlock.count' do
        assert_no_difference 'TournamentEvent.count' do
          assert_no_difference 'Notification.count' do
            post api_v1_activities_path,
                 params: {
                   started_at: Time.zone.at(1_800).iso8601,
                   finished_at: Time.zone.at(2_040).iso8601,
                   distance_meters: 2_400,
                   elapsed_time_seconds: 240,
                   source: 'mobile_android',
                   gps_points: [
                     { lat: 50.45, lng: 30.55, ts: 1_800, accuracy: 5 },
                     { lat: 50.46, lng: 30.56, ts: 1_900, accuracy: 5 },
                     { lat: 50.45, lng: 30.58, ts: 1_940, accuracy: 5 },
                     { lat: 50.46, lng: 30.59, ts: 2_040, accuracy: 5 }
                   ]
                 },
                 headers: auth_headers(runner)
          end
        end
      end
    end

    assert_response :created
    body = response.parsed_body
    assert_equal 0, body['segment_efforts_count']
    assert_equal [{ 'tournament_name' => tournament.name, 'position' => 1 }], body['pending_rated_unlocks']
    assert_empty TournamentEvent.where(tournament:)
    assert_equal 0, spectator.notifications.where(tournament:).count
    assert_equal 0, runner.notifications.where(tournament:).count
  end

  test 'activity only unlocks later rated segment after earlier segment was passed first' do
    owner = create_user(email: 'activity-order-owner@example.com')
    runner = create_user(email: 'activity-order-runner@example.com')
    tournament = create_tournament(owner, status: 'active', total_segments_count: 3, rated_segments_count: 2)
    first = create_segment(owner, name: 'First Rated', lng_offset: 0.0)
    second = create_segment(owner, name: 'Second Rated', lng_offset: 0.03)
    tournament.tournament_segments.create!(segment: first, order_number: 1, is_rated: true)
    tournament.tournament_segments.create!(segment: second, order_number: 2, is_rated: true)
    tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))
    gps_points = gps_points_for_segment(lng_offset: 0.03, start_ts: 1_800, end_ts: 2_100) +
                 gps_points_for_segment(lng_offset: 0.0, start_ts: 2_500, end_ts: 2_800)

    assert_difference 'SegmentEffort.count', 1 do
      assert_difference 'TournamentSegmentUnlock.count', 1 do
        assert_difference 'TournamentEvent.count', 1 do
          post api_v1_activities_path,
                 params: {
                   started_at: Time.zone.at(1_800).iso8601,
                   finished_at: Time.zone.at(2_800).iso8601,
                   distance_meters: 5_000,
                   elapsed_time_seconds: 1_000,
                   source: 'mobile_android',
                   gps_points:
                 },
                 headers: auth_headers(runner)
        end
      end
    end

    assert_response :created
    effort_names = response.parsed_body['segment_efforts'].map { |effort| effort.dig('segment', 'name') }
    assert_equal ['First Rated'], effort_names
    assert_empty response.parsed_body['pending_rated_unlocks']
    event_names = TournamentEvent.where(tournament:).order(:id).map { |event| event.segment.name }
    assert_equal ['First Rated'], event_names
  end

  test 'repeat rated segment keeps one unlock and only recalculates score when best effort improves' do
    owner = create_user(email: 'activity-repeat-owner@example.com')
    runner = create_user(email: 'activity-repeat-runner@example.com')
    spectator = create_user(email: 'activity-repeat-spectator@example.com')
    tournament = create_tournament(owner, status: 'active', total_segments_count: 2, rated_segments_count: 1)
    segment = create_segment(owner, name: 'Repeat Rated', lng_offset: 0.0)
    tournament.tournament_segments.create!(segment:, order_number: 1, is_rated: true)
    participant = tournament.tournament_participants.create!(user: runner, joined_at: Time.zone.at(1_700))
    tournament.tournament_participants.create!(user: spectator, joined_at: Time.zone.at(1_700))

    recalculate_calls = []
    original_recalculate = TournamentScore.method(:recalculate_all)
    TournamentScore.define_singleton_method(:recalculate_all) do |changed_tournament|
      recalculate_calls << changed_tournament.id
      original_recalculate.call(changed_tournament)
    end

    begin
      assert_difference 'SegmentEffort.count', 1 do
        assert_difference 'TournamentSegmentUnlock.count', 1 do
          assert_difference 'TournamentEvent.count', 1 do
            post api_v1_activities_path,
                 params: activity_payload_for_segment(start_ts: 1_800, end_ts: 1_980),
                 headers: auth_headers(runner)
          end
        end
      end

      assert_response :created
      assert_equal [tournament.id], recalculate_calls
      assert_equal 1, TournamentSegmentUnlock.where(tournament:, user: runner, segment:).count
      assert_equal 1, TournamentEvent.where(tournament:, segment:).count
      recalculate_calls.clear

      assert_difference 'SegmentEffort.count', 1 do
        assert_no_difference 'TournamentSegmentUnlock.count' do
          assert_no_difference 'TournamentEvent.count' do
            assert_no_difference 'Notification.count' do
              post api_v1_activities_path,
                   params: activity_payload_for_segment(start_ts: 2_100, end_ts: 2_310),
                   headers: auth_headers(runner)
            end
          end
        end
      end

      assert_response :created
      assert_equal 1, response.parsed_body['segment_efforts_count']
      assert_empty recalculate_calls

      assert_difference 'SegmentEffort.count', 1 do
        assert_no_difference 'TournamentSegmentUnlock.count' do
          assert_no_difference 'TournamentEvent.count' do
            assert_no_difference 'Notification.count' do
              post api_v1_activities_path,
                   params: activity_payload_for_segment(start_ts: 2_500, end_ts: 2_650),
                   headers: auth_headers(runner)
            end
          end
        end
      end

      assert_response :created
      assert_equal [tournament.id], recalculate_calls
      best_effort = TournamentScore.best_efforts_for(tournament, participant, segment_ids: [segment.id]).first
      assert_equal 150, best_effort.elapsed_time_seconds
    ensure
      TournamentScore.define_singleton_method(:recalculate_all, original_recalculate)
    end
  end

  private

  def create_user(email:, role: 'user', gender: 'other', first_name: nil)
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      role:,
      gender:,
      first_name:
    )
  end

  def create_club(email:, club_name:)
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      account_type: 'club',
      club_name:
    )
  end

  def create_tournament(user, name: nil, status: 'draft', total_segments_count: 2, rated_segments_count: 1)
    Tournament.create!(
      name: name || "Lifecycle Cup #{SecureRandom.hex(4)}",
      description: 'Lifecycle tournament',
      created_by: user,
      total_segments_count:,
      rated_segments_count:,
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

  def create_notification(user, tournament, title:)
    user.notifications.create!(
      tournament:,
      notification_type: 'segment_unlocked',
      title:,
      body: "#{title} body"
    )
  end

  def create_effort(user:, segment:, elapsed:, started_at:)
    activity = user.activities.create!(
      started_at: started_at - 1.minute,
      finished_at: started_at + elapsed.seconds,
      distance_meters: segment.distance_meters,
      elapsed_time_seconds: elapsed,
      source: 'mobile_android'
    )
    SegmentEffort.create!(
      user:,
      segment:,
      activity:,
      elapsed_time_seconds: elapsed,
      started_at:
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

  def gps_points_for_segment(lng_offset:, start_ts:, end_ts:, steps: 60)
    0.upto(steps).map do |index|
      ratio = index / steps.to_f
      {
        lat: 50.45 + (0.01 * ratio),
        lng: 30.52 + lng_offset + (0.01 * ratio),
        ts: start_ts + ((end_ts - start_ts) * ratio).round,
        accuracy: 5
      }
    end
  end

  def activity_payload_for_segment(start_ts:, end_ts:, lng_offset: 0.0)
    {
      started_at: Time.zone.at(start_ts).iso8601,
      finished_at: Time.zone.at(end_ts).iso8601,
      distance_meters: 700,
      elapsed_time_seconds: end_ts - start_ts,
      source: 'mobile_android',
      gps_points: gps_points_for_segment(lng_offset:, start_ts:, end_ts:)
    }
  end

  def auth_headers(user)
    { 'Authorization' => "Bearer #{JwtService.encode(user_id: user.id)}" }
  end

  def with_google_verifier(payload)
    original_verifier = GoogleIdentityTokenVerifier
    stubbed_verifier = Class.new do
      define_method(:verify!) { |_id_token| payload }
    end
    stubbed_verifier.const_set(:Error, Class.new(StandardError))

    Object.send(:remove_const, :GoogleIdentityTokenVerifier)
    Object.const_set(:GoogleIdentityTokenVerifier, stubbed_verifier)
    yield
  ensure
    Object.send(:remove_const, :GoogleIdentityTokenVerifier)
    Object.const_set(:GoogleIdentityTokenVerifier, original_verifier)
  end
end
