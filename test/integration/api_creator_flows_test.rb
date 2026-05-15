require 'test_helper'

class ApiCreatorFlowsTest < ActionDispatch::IntegrationTest
  test 'club can register create own segment tournament and submit review request' do
    post api_v1_auth_register_path, params: {
      email: 'club@example.com',
      password: 'password123',
      password_confirmation: 'password123',
      account_type: 'club',
      club_name: 'Kyiv Runners'
    }

    assert_response :created
    token = response.parsed_body['token']
    headers = { 'Authorization' => "Bearer #{token}" }

    post(api_v1_segments_path,
         params: segment_params(name: 'Club Segment'),
         headers:)
    assert_response :created
    segment_id = response.parsed_body['id']

    post(api_v1_tournaments_path,
         params: {
           name: 'Club Cup',
           description: 'Created by club',
           total_segments_count: 2,
           rated_segments_count: 1,
           city: 'Kyiv',
           country: 'UA'
         },
         headers:)
    assert_response :created
    tournament = response.parsed_body
    assert_equal 'draft', tournament['status']
    assert_equal 'Kyiv Runners', tournament['created_by']['display_name']

    post(add_segment_api_v1_tournament_path(tournament['slug']),
         params: { segment_id:, is_rated: '1', order_number: 1 },
         headers:)
    assert_response :success

    post(api_v1_segments_path,
         params: segment_params(name: 'Visible Segment'),
         headers:)
    assert_response :created
    visible_segment_id = response.parsed_body['id']

    post(add_segment_api_v1_tournament_path(tournament['slug']),
         params: { segment_id: visible_segment_id, is_rated: '0', order_number: 2 },
         headers:)
    assert_response :success

    post(submit_for_review_api_v1_tournament_path(tournament['slug']), headers:)
    assert_response :success
    assert_equal 'pending_review', response.parsed_body['status']
  end

  test 'creator cannot add another users segment to tournament' do
    owner = create_user(email: 'owner@example.com')
    other = create_user(email: 'other@example.com')
    tournament = create_tournament(owner)
    segment = create_segment(other, name: 'Other Segment')

    post add_segment_api_v1_tournament_path(tournament.slug),
         params: { segment_id: segment.id, is_rated: '1' },
         headers: auth_headers(owner)

    assert_response :not_found
    assert_equal 0, tournament.tournament_segments.count
  end

  test 'segment creation requires a valid drawn route' do
    user = create_user(email: 'route-check@example.com')

    post api_v1_segments_path,
         params: { name: 'Broken Route', points: [{ lat: 50.45, lng: 30.52 }] },
         headers: auth_headers(user)

    assert_response :unprocessable_content
    assert_includes response.parsed_body['errors'].join, 'Route must include at least two valid points'

    post api_v1_segments_path,
         params: { name: 'Injected Route', points: [{ lat: 'oops', lng: 30.52 }, { lat: 50.46, lng: 30.53 }] },
         headers: auth_headers(user)

    assert_response :unprocessable_content
    assert_includes response.parsed_body['errors'].join, 'Route contains invalid coordinates'
  end

  test 'segment descriptions are sanitized on api creation' do
    user = create_user(email: 'rich-text@example.com')

    post api_v1_segments_path,
         params: segment_params(name: 'Rich Segment').merge(
           description: '<p>Safe <strong>text</strong></p><script>alert("x")</script>'
         ),
         headers: auth_headers(user)

    assert_response :created
    assert_includes response.parsed_body['description'], '<strong>text</strong>'
    assert_not_includes response.parsed_body['description'], '<script'
  end

  test 'admin can approve or reject pending tournament requests' do
    admin = create_user(email: 'admin@example.com', role: 'admin')
    owner = create_user(email: 'runner@example.com')
    tournament = create_tournament(owner, status: 'pending_review')

    post admin_login_path, params: { email: admin.email, password: 'password123' }
    post approve_admin_tournament_path(tournament)

    assert_redirected_to admin_tournament_path(tournament)
    assert_equal 'active', tournament.reload.status
    assert_equal admin, tournament.reviewed_by

    rejected = create_tournament(owner, name: 'Rejected Cup', status: 'pending_review')
    post reject_admin_tournament_path(rejected), params: { review_note: 'Needs clearer segments' }

    assert_redirected_to admin_tournament_path(rejected)
    assert_equal 'rejected', rejected.reload.status
    assert_equal 'Needs clearer segments', rejected.review_note
  end

  private

  def create_user(email:, role: 'user')
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      role:,
      gender: 'other'
    )
  end

  def create_tournament(user, name: 'Creator Cup', status: 'draft')
    Tournament.create!(
      name:,
      description: "#{name} description",
      created_by: user,
      total_segments_count: 2,
      rated_segments_count: 1,
      city: 'Kyiv',
      country: 'UA',
      status:
    )
  end

  def create_segment(user, name:)
    Segment.create!(
      name:,
      created_by: user,
      is_active: true,
      city: 'Kyiv',
      country: 'UA',
      **segment_geometry
    )
  end

  def segment_params(name:)
    {
      name:,
      city: 'Kyiv',
      country: 'UA',
      start_lat: 50.45,
      start_lng: 30.52,
      end_lat: 50.46,
      end_lng: 30.53
    }
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
