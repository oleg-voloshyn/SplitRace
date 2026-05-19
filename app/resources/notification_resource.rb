class NotificationResource
  include Alba::Resource

  attributes :id, :notification_type, :title, :body, :read_at, :created_at

  attribute :tournament do |notification|
    if notification.tournament
      {
        id: notification.tournament.id,
        name: notification.tournament.name,
        slug: notification.tournament.slug
      }
    end
  end
end
