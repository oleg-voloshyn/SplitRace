class CreatorResource
  include Alba::Resource

  attributes :id, :account_type
  attribute :display_name, &:display_name
end
