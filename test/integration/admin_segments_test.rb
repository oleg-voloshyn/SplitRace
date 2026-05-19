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
    assert_select "input[type='text'][name='segment[city]']", false
    assert_select "input[type='text'][name='segment[country]']", false
    assert_select "input[type='hidden'][name='segment[city]']"
    assert_select "input[type='hidden'][name='segment[country]']"
    assert_select "#segment-location"
    assert_select "trix-editor[input='segment_description']"
    assert_select "input#waypoints-json" do |inputs|
      points = JSON.parse(inputs.first["value"])

      assert_equal 2, points.length
      assert_in_delta 50.45, points.first["lat"]
      assert_in_delta 30.52, points.first["lng"]
      assert_in_delta 50.46, points.last["lat"]
      assert_in_delta 30.53, points.last["lng"]
    end
  end

  test "segment descriptions support safe rich text and strip unsafe html" do
    assert_difference "Segment.count", 1 do
      post admin_segments_path, params: {
        segment: {
          name: "Rich Segment",
          description: "<p><strong>Safe</strong></p><script>alert(1)</script><a href='javascript:alert(1)' onclick='x()'>bad</a>",
          city: "Kyiv",
          country: "UA",
          is_active: "1",
          waypoints_json: [
            { lat: 50.45, lng: 30.52 },
            { lat: 50.46, lng: 30.53 }
          ].to_json
        }
      }
    end

    segment = Segment.find_by!(name: "Rich Segment")
    assert_includes segment.description, "<strong>Safe</strong>"
    assert_not_includes segment.description, "<script"
    assert_not_includes segment.description, "javascript:"
    assert_not_includes segment.description, "onclick"

    get api_v1_segment_path(segment), headers: api_headers
    assert_response :success
    body = response.parsed_body
    assert_includes body["description"], "<strong>Safe</strong>"
    assert_not_includes body["description"], "javascript:"
  end

  test "create accepts automatically detected city and country" do
    assert_difference "Segment.count", 1 do
      post admin_segments_path, params: {
        segment: {
          name: "Auto Located Segment",
          description: "Detected from route",
          city: "Kyiv",
          country: "UA",
          is_active: "1",
          waypoints_json: [
            { lat: 50.45, lng: 30.52 },
            { lat: 50.46, lng: 30.53 }
          ].to_json
        }
      }
    end

    segment = Segment.find_by!(name: "Auto Located Segment")
    assert_equal "Kyiv", segment.city
    assert_equal "UA", segment.country
    assert_redirected_to admin_segments_path
  end

  test "create rejects short segment route" do
    assert_no_difference "Segment.count" do
      post admin_segments_path, params: {
        segment: {
          name: "Tiny Segment",
          is_active: "1",
          waypoints_json: [
            { lat: 50.45, lng: 30.52 },
            { lat: 50.45, lng: 30.521 }
          ].to_json
        }
      }
    end

    assert_response :unprocessable_content
    assert_select ".alert", text: /#{Regexp.escape(Segment::MIN_DISTANCE_ERROR)}/o
  end

  test "index renders delete form with confirmation modal wiring" do
    get admin_segments_path

    assert_response :success
    assert_select "#confirm-modal"
    assert_select "form[action='#{admin_segment_path(@segment)}'][method='post'][data-confirm-modal*='Delete #{@segment.name}']"
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

  def api_headers
    { "Authorization" => "Bearer #{JwtService.encode(user_id: @admin.id)}" }
  end
end
