require "test_helper"

class AdminFlowsTest < ActionDispatch::IntegrationTest
  setup do
    @admin = create_user(email: "admin-flows@example.com", role: "admin")
    post admin_login_path, params: { email: @admin.email, password: "password123" }
  end

  test "admin pages require admin session" do
    post admin_logout_path

    get admin_root_path

    assert_redirected_to admin_login_path
    follow_redirect!
    assert_response :success
    assert_select "p", text: "Admin panel"
  end

  test "dashboard renders summary and recent content links" do
    tournament = create_tournament(name: "Dashboard Cup")
    segment = create_segment(name: "Dashboard Segment")

    get admin_root_path

    assert_response :success
    assert_select "h1", "Dashboard"
    assert_select "a[href='#{admin_tournament_path(tournament)}']", text: tournament.name
    assert_select "a[href='#{edit_admin_segment_path(segment)}']", text: segment.name
  end

  test "tournament lifecycle can create edit manage activate complete and delete" do
    segment_one = create_segment(name: "Rated Segment")
    segment_two = create_segment(name: "Hidden Decoy")

    assert_difference "Tournament.count", 1 do
      post admin_tournaments_path, params: {
        tournament: {
          name: "Lifecycle Cup",
          description: "Original description",
          total_segments_count: 2,
          rated_segments_count: 1,
          city: "Kyiv",
          country: "UA"
        }
      }
    end

    tournament = Tournament.find_by!(name: "Lifecycle Cup")
    assert_redirected_to admin_tournament_path(tournament)

    patch admin_tournament_path(tournament), params: {
      tournament: { name: "Lifecycle Cup Updated", description: "Updated description" }
    }
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal "Lifecycle Cup Updated", tournament.reload.name

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_one.id, is_rated: "1" }
    assert_redirected_to admin_tournament_path(tournament)
    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_two.id, is_rated: "0" }
    assert_redirected_to admin_tournament_path(tournament)

    get admin_tournament_path(tournament)
    assert_response :success
    assert_select "td", text: segment_one.name
    assert_select "td", text: segment_two.name

    post activate_admin_tournament_path(tournament)
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal "active", tournament.reload.status

    post complete_admin_tournament_path(tournament)
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal "completed", tournament.reload.status

    get admin_tournaments_path
    assert_response :success
    assert_select "form[action='#{admin_tournament_path(tournament)}'][method='post'][onsubmit*='confirm']"
    assert_select "form[action='#{admin_tournament_path(tournament)}'] input[name='_method'][value='delete']"

    assert_difference "Tournament.count", -1 do
      delete admin_tournament_path(tournament)
    end
    assert_redirected_to admin_tournaments_path
  end

  test "tournament segment management enforces configured limits and can remove segment" do
    tournament = create_tournament(name: "Limit Cup", total_segments_count: 2, rated_segments_count: 1)
    segment_one = create_segment(name: "Only Slot")
    segment_two = create_segment(name: "Second Slot")
    segment_three = create_segment(name: "Overflow Slot")

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_one.id, is_rated: "1" }
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal 1, tournament.tournament_segments.count

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_two.id, is_rated: "0" }
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal 2, tournament.tournament_segments.count

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_three.id, is_rated: "0" }
    assert_redirected_to admin_tournament_path(tournament)
    follow_redirect!
    assert_select ".alert-danger", /Cannot add more segments/
    assert_equal 2, tournament.tournament_segments.count

    post remove_segment_admin_tournament_path(tournament, segment_id: segment_one.id)
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal 1, tournament.tournament_segments.count
  end

  test "users can be listed and roles updated" do
    user = create_user(email: "runner@example.com", role: "user", first_name: "Runner")

    get admin_users_path
    assert_response :success
    assert_select "td", text: user.email
    assert_select "a[href='#{edit_admin_user_path(user)}']", text: "Edit role"

    patch admin_user_path(user), params: { user: { role: "moderator" } }
    assert_redirected_to admin_users_path
    assert_equal "moderator", user.reload.role
  end

  test "activities index filter and show render route and matched efforts" do
    runner = create_user(email: "activity-runner@example.com", first_name: "Activity")
    segment = create_segment(name: "Matched Segment", distance_meters: 1_000)
    activity = runner.activities.create!(
      started_at: Time.current,
      finished_at: 30.minutes.from_now,
      distance_meters: 1_500,
      elapsed_time_seconds: 600,
      source: "mobile_android",
      gps_points: [
        { "lat" => 50.45, "lng" => 30.52, "ts" => Time.current.to_i },
        { "lat" => 50.46, "lng" => 30.53, "ts" => 10.minutes.from_now.to_i }
      ]
    )
    activity.segment_efforts.create!(
      user: runner,
      segment: segment,
      elapsed_time_seconds: 300,
      started_at: activity.started_at
    )

    get admin_activities_path(user_id: runner.id)
    assert_response :success
    assert_select "h1", /Activities/
    assert_select "td", text: "mobile_android"
    assert_select "a[href='#{admin_activity_path(activity)}']", text: "View"

    get admin_activity_path(activity)
    assert_response :success
    assert_select "h1", /Activity by/
    assert_select "#activity-map"
    assert_select "td", text: segment.name
  end

  test "cheating reports can be filtered reviewed and protected from invalid status" do
    reporter = create_user(email: "reporter@example.com", first_name: "Reporter")
    reported = create_user(email: "reported@example.com", first_name: "Reported")
    tournament = create_tournament(name: "Reports Cup")
    report = CheatingReport.create!(
      reporter: reporter,
      reported_user: reported,
      tournament: tournament,
      reason: "Suspicious segment effort with impossible pace."
    )

    get admin_cheating_reports_path(status: "pending")
    assert_response :success
    assert_select "a[href='#{admin_cheating_report_path(report)}']", text: "Review"

    get admin_cheating_report_path(report)
    assert_response :success
    assert_select "h1", "Report ##{report.id}"
    assert_select "form[action='#{admin_cheating_report_path(report)}'] input[name='_method'][value='patch']"

    patch admin_cheating_report_path(report), params: { status: "invalid", admin_notes: "Nope" }
    assert_redirected_to admin_cheating_report_path(report)
    assert_equal "pending", report.reload.status

    patch admin_cheating_report_path(report), params: { status: "upheld", admin_notes: "Confirmed." }
    assert_redirected_to admin_cheating_reports_path
    assert_equal "upheld", report.reload.status
    assert_equal @admin, report.reviewed_by
    assert_equal "Confirmed.", report.admin_notes
  end

  private

  def create_user(email:, role: "user", first_name: "Test", last_name: "User")
    User.create!(
      email: email,
      password: "password123",
      role: role,
      first_name: first_name,
      last_name: last_name,
      locale: "en",
      units: "km",
      gender: "other"
    )
  end

  def create_tournament(name:, total_segments_count: 2, rated_segments_count: 1)
    Tournament.create!(
      name: name,
      description: "#{name} description",
      created_by: @admin,
      total_segments_count: total_segments_count,
      rated_segments_count: rated_segments_count,
      city: "Kyiv",
      country: "UA"
    )
  end

  def create_segment(name:, distance_meters: 1_500)
    Segment.create!(
      name: name,
      city: "Kyiv",
      country: "UA",
      created_by: @admin,
      is_active: true,
      **segment_geometry(distance_meters: distance_meters)
    )
  end

  def segment_geometry(distance_meters:)
    factory = RGeo::Geographic.spherical_factory(srid: 4326)
    points = [
      factory.point(30.52, 50.45),
      factory.point(30.53, 50.46)
    ]

    {
      start_point: points.first,
      end_point: points.last,
      polyline: factory.multi_line_string([factory.line_string(points)]),
      distance_meters: distance_meters
    }
  end
end
