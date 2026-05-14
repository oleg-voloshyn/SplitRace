require 'test_helper'

class ApiProfileTest < ActionDispatch::IntegrationTest
  test 'me returns a gravatar fallback avatar' do
    user = create_user(email: 'runner@example.com', avatar_url: nil)
    hash = Digest::MD5.hexdigest('runner@example.com')

    get api_v1_me_path, headers: auth_headers(user)

    assert_response :success
    body = response.parsed_body
    assert_equal "https://www.gravatar.com/avatar/#{hash}?s=160&d=mp", body['avatar_url']
  end

  test 'profile update accepts mobile nested user params' do
    user = create_user(email: 'mobile-profile@example.com')

    patch api_v1_me_path,
          params: {
            user: {
              first_name: 'Mobile',
              last_name: 'Runner',
              gender: 'female',
              units: 'miles',
              country: 'UA',
              city: 'Kyiv'
            }
          },
          headers: auth_headers(user)

    assert_response :success
    user.reload
    assert_equal 'Mobile', user.first_name
    assert_equal 'Runner', user.last_name
    assert_equal 'female', user.gender
    assert_equal 'miles', user.units
    assert_equal 'UA', user.country
    assert_equal 'Kyiv', user.city
  end

  test 'profile update accepts web top level params' do
    user = create_user(email: 'web-profile@example.com')

    patch api_v1_me_path,
          params: {
            first_name: 'Web',
            last_name: 'Runner',
            city: 'Lviv'
          },
          headers: auth_headers(user)

    assert_response :success
    user.reload
    assert_equal 'Web', user.first_name
    assert_equal 'Runner', user.last_name
    assert_equal 'Lviv', user.city
  end

  private

  def create_user(email:, avatar_url: nil)
    User.create!(
      email:,
      password: 'password123',
      password_confirmation: 'password123',
      avatar_url:
    )
  end

  def auth_headers(user)
    { 'Authorization' => "Bearer #{JwtService.encode(user_id: user.id)}" }
  end
end
