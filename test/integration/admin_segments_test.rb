require "test_helper"

class AdminSegmentsTest < ActionDispatch::IntegrationTest
  setup do
    @admin = User.create!(
      email: "admin@example.com",
      password: "password123",
      role: "admin",
      locale: "en",
      units: "km",
      gender: "other"
    )

    post admin_login_path, params: { email: @admin.email, password: "password123" }

    @segment = Segment.create!(
      name: "Test Segment",
      created_by: @admin,
      is_active: true,
      **segment_geometry
    )
  end

  test "edit preloads segment waypoints" do
    get edit_admin_segment_path(@segment)

    assert_response :success
    assert_select "input#waypoints-json" do |inputs|
      points = JSON.parse(inputs.first["value"])

      assert_equal 2, points.length
      assert_in_delta 50.45, points.first["lat"]
      assert_in_delta 30.52, points.first["lng"]
      assert_in_delta 50.46, points.last["lat"]
      assert_in_delta 30.53, points.last["lng"]
    end
  end

  test "index renders delete form that submits delete with native confirmation" do
    get admin_segments_path

    assert_response :success
    assert_select "form[action='#{admin_segment_path(@segment)}'][method='post'][onsubmit*='confirm']"
    assert_select "form[action='#{admin_segment_path(@segment)}'] input[name='_method'][value='delete']"

    assert_difference "Segment.count", -1 do
      delete admin_segment_path(@segment)
    end
    assert_redirected_to admin_segments_path
  end

  private

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
end
