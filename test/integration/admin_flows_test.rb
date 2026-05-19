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
    reporter = create_user(email: "reporter@example.com")
    reported = create_user(email: "reported@example.com")
    CheatingReport.create!(
      reporter:,
      reported_user: reported,
      tournament:,
      reason: "Suspicious activity on multiple segments"
    )

    get admin_tournaments_path
    assert_response :success
    assert_select "#confirm-modal"
    assert_select "form[action='#{admin_tournament_path(tournament)}'][method='post'][data-confirm-modal*='Delete #{tournament.name}']"
    assert_select "form[action='#{admin_tournament_path(tournament)}'] input[name='_method'][value='delete']"

    deleted_tournament_path = admin_tournament_path(tournament)
    assert_difference -> { Tournament.count }, -1 do
      assert_difference -> { CheatingReport.count }, -1 do
        post deleted_tournament_path, params: { _method: "delete" }
      end
    end
    assert_redirected_to admin_tournaments_path
    assert_response :see_other
    follow_redirect!
    assert_response :success
    assert_select "h1", "Tournaments"

    get deleted_tournament_path
    assert_redirected_to admin_tournaments_path
  end

  test "tournament descriptions support safe rich text and strip unsafe html" do
    unsafe_description = <<~HTML
      <div><strong>Bold intro</strong></div>
      <ul><li>Safe list item</li></ul>
      <script>window.evil = true</script>
      <a href="javascript:alert(1)" onclick="alert(2)">unsafe link</a>
      <iframe src="https://evil.example"></iframe>
    HTML

    post admin_tournaments_path, params: {
      tournament: {
        name: "Rich Text Cup",
        description: unsafe_description,
        total_segments_count: 2,
        rated_segments_count: 1,
        city: "Kyiv",
        country: "UA"
      }
    }

    tournament = Tournament.find_by!(name: "Rich Text Cup")
    assert_includes tournament.description, "<strong>Bold intro</strong>"
    assert_includes tournament.description, "<li>Safe list item</li>"
    assert_not_includes tournament.description, "<script"
    assert_not_includes tournament.description, "window.evil"
    assert_not_includes tournament.description, "<iframe"
    assert_not_includes tournament.description, "javascript:"
    assert_not_includes tournament.description, "onclick"

    get admin_tournament_path(tournament)
    assert_response :success
    assert_select ".sr-rich-text-content strong", text: "Bold intro"
    assert_select ".sr-rich-text-content script", count: 0
    assert_select ".sr-rich-text-content iframe", count: 0

    get api_v1_tournament_path(tournament.slug), headers: api_headers
    assert_response :success
    body = response.parsed_body
    assert_includes body["description"], "<strong>Bold intro</strong>"
    assert_not_includes body["description"], "javascript:"
  end

  test "tournaments index supports search sorting and pagination" do
    create_tournament(name: "Zulu Cup", city: "Lviv")
    create_tournament(name: "Alpha Cup", city: "Kyiv")
    26.times { |i| create_tournament(name: "Paged Tournament #{i}") }

    get admin_tournaments_path(q: "Alpha", sort: "name", direction: "asc")
    assert_response :success
    assert_select "input[name='q'][value='Alpha']"
    assert_includes table_first_column_texts, "Alpha Cup"
    assert_not_includes table_first_column_texts, "Zulu Cup"

    get admin_tournaments_path(sort: "name", direction: "asc")
    assert_response :success
    assert_equal "Alpha Cup", table_first_column_texts.first
    assert_select ".pagination"

    get admin_tournaments_path(page: 2, sort: "name", direction: "asc")
    assert_response :success
    assert_select ".page-item.active", text: "2"
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

    get admin_tournament_path(tournament)
    assert_response :success
    assert_select "form[action='#{remove_segment_admin_tournament_path(tournament, segment_id: segment_two.id)}'][data-confirm-modal*='Remove #{segment_two.name}']"
  end

  test "tournament add segment picker is searchable and excludes selected segments" do
    tournament = create_tournament(name: "Picker Cup", total_segments_count: 3, rated_segments_count: 1)
    selected_segment = create_segment(name: "Already Added")
    available_segment = create_segment(name: "Searchable Segment", city: "Lviv")

    post add_segment_admin_tournament_path(tournament), params: { segment_id: selected_segment.id, is_rated: "1" }
    assert_redirected_to admin_tournament_path(tournament)

    get admin_tournament_path(tournament)

    assert_response :success
    assert_select "input[type='search'][data-segment-picker-search][placeholder='Search segment...']"
    assert_select "[data-segment-picker-options] [data-segment-picker-option]", text: /Searchable Segment/
    assert_select "[data-segment-picker-options] [data-segment-picker-option]", text: /Lviv/
    assert_select "[data-segment-picker-options] [data-segment-picker-option]", { text: /Already Added/, count: 0 }
    assert_select "input[type='radio'][name='segment_id'][value='#{available_segment.id}']"
  end

  test "tournament segments can be inserted at a selected rating position" do
    tournament = create_tournament(name: "Position Cup", total_segments_count: 4, rated_segments_count: 3)
    segment_one = create_segment(name: "First Rated")
    segment_two = create_segment(name: "Second Rated")
    segment_three = create_segment(name: "Inserted Rated")
    create_segment(name: "Available Later")

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_one.id, is_rated: "1", order_number: 1 }
    assert_redirected_to admin_tournament_path(tournament)
    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_two.id, is_rated: "1", order_number: 2 }
    assert_redirected_to admin_tournament_path(tournament)

    post add_segment_admin_tournament_path(tournament), params: { segment_id: segment_three.id, is_rated: "1", order_number: 2 }
    assert_redirected_to admin_tournament_path(tournament)

    ordered_names = tournament.tournament_segments.includes(:segment).order(:order_number).map { |ts| ts.segment.name }
    assert_equal ["First Rated", "Inserted Rated", "Second Rated"], ordered_names
    assert_equal [1, 2, 3], tournament.tournament_segments.order(:order_number).pluck(:order_number)

    get admin_tournament_path(tournament)
    assert_response :success
    assert_select "select[name='order_number'] option[value='4']", text: "#4"
    assert_select "button[data-rated-position-toggle][aria-label='Show rated segment position']", count: 3
    assert_select "span[data-rated-position-value].d-none", text: "#1"
    assert_select "span[data-rated-position-value].d-none", text: "#2"
    assert_select "span[data-rated-position-value].d-none", text: "#3"

    post remove_segment_admin_tournament_path(tournament, segment_id: segment_one.id)
    assert_redirected_to admin_tournament_path(tournament)
    assert_equal [1, 2], tournament.tournament_segments.order(:order_number).pluck(:order_number)
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

  test "users index supports search sorting and pagination" do
    create_user(email: "zulu@example.com", first_name: "Zulu")
    create_user(email: "alpha@example.com", first_name: "Alpha")
    26.times { |i| create_user(email: "paged-user-#{i}@example.com", first_name: "Paged#{i}") }

    get admin_users_path(q: "alpha", sort: "email", direction: "asc")
    assert_response :success
    assert_select "input[name='q'][value='alpha']"
    assert_select "td", text: "alpha@example.com"
    assert_select "td", { text: "zulu@example.com", count: 0 }

    get admin_users_path(sort: "email", direction: "asc")
    assert_response :success
    assert_equal "admin-flows@example.com", table_column_texts(2).first
    assert_select ".pagination"

    get admin_users_path(page: 2, sort: "email", direction: "asc")
    assert_response :success
    assert_select ".page-item.active", text: "2"
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
      suspicious: true,
      suspicious_reasons: [
        { "code" => "teleport_jump", "message" => "GPS points jump too far in too little time." }
      ],
      gps_quality: { "max_point_speed_mps" => 42.5 },
      gps_points: [
        { "lat" => 50.45, "lng" => 30.52, "ts" => Time.current.to_i },
        { "lat" => 50.46, "lng" => 30.53, "ts" => 10.minutes.from_now.to_i }
      ]
    )
    activity.segment_efforts.create!(
      user: runner,
      segment:,
      elapsed_time_seconds: 300,
      started_at: activity.started_at
    )

    get admin_activities_path(user_id: runner.id)
    assert_response :success
    assert_select "h1", /Activities/
    assert_select "td", text: "mobile_android"
    assert_select ".badge", text: "Suspicious"
    assert_select "a[href='#{admin_activity_path(activity)}']", text: "View"

    get admin_activity_path(activity)
    assert_response :success
    assert_select "h1", /Activity by/
    assert_select "#activity-map"
    assert_select "td", text: segment.name
    assert_select ".badge", text: "Suspicious"
    assert_select "li", text: "GPS points jump too far in too little time."

    get admin_activities_path(user_id: runner.id, suspicious: "1")
    assert_response :success
    assert_select "a[href='#{admin_activity_path(activity)}']", text: "View"
  end

  test "segments index supports search sorting and pagination" do
    create_segment(name: "Zulu Segment", city: "Lviv")
    create_segment(name: "Alpha Segment", city: "Kyiv")
    26.times { |i| create_segment(name: "Paged Segment #{i}") }

    get admin_segments_path(q: "Alpha", sort: "name", direction: "asc")
    assert_response :success
    assert_select "input[name='q'][value='Alpha']"
    assert_includes table_first_column_texts, "Alpha Segment"
    assert_not_includes table_first_column_texts, "Zulu Segment"

    get admin_segments_path(sort: "name", direction: "asc")
    assert_response :success
    assert_equal "Alpha Segment", table_first_column_texts.first
    assert_select ".pagination"

    get admin_segments_path(page: 2, sort: "name", direction: "asc")
    assert_response :success
    assert_select ".page-item.active", text: "2"
  end

  test "cheating reports can be filtered reviewed and protected from invalid status" do
    reporter = create_user(email: "reporter@example.com", first_name: "Reporter")
    reported = create_user(email: "reported@example.com", first_name: "Reported")
    tournament = create_tournament(name: "Reports Cup")
    report = CheatingReport.create!(
      reporter:,
      reported_user: reported,
      tournament:,
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
      email:,
      password: "password123",
      role:,
      first_name:,
      last_name:,
      locale: "en",
      units: "km",
      gender: "other"
    )
  end

  def create_tournament(name:, total_segments_count: 2, rated_segments_count: 1, city: "Kyiv")
    Tournament.create!(
      name:,
      description: "#{name} description",
      created_by: @admin,
      total_segments_count:,
      rated_segments_count:,
      city:,
      country: "UA"
    )
  end

  def create_segment(name:, distance_meters: 1_500, city: "Kyiv")
    Segment.create!(
      name:,
      city:,
      country: "UA",
      created_by: @admin,
      is_active: true,
      **segment_geometry(distance_meters:)
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
      distance_meters:
    }
  end

  def table_first_column_texts
    css_select("tbody tr td:first-child").map { |node| node.text.squish }
  end

  def table_column_texts(position)
    css_select("tbody tr td:nth-child(#{position})").map { |node| node.text.squish }
  end

  def api_headers
    { "Authorization" => "Bearer #{JwtService.encode(user_id: @admin.id)}" }
  end
end
