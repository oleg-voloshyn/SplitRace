class UserResource
  include Alba::Resource

  attributes :id, :email, :first_name, :last_name, :account_type, :club_name,
             :gender, :role, :units, :locale

  attribute :display_name, &:display_name
  attribute :full_name,    &:full_name
  attribute :avatar_url,   &:profile_avatar_url

  # `/me` and `BaseController#user_json` carry full profile + linked providers;
  # `/auth/*` responses omit these.
  attributes :country, :city, if: proc { params[:detailed] }
  attribute :providers, if: proc { params[:detailed] } do |u|
    u.oauth_identities.pluck(:provider)
  end
end
