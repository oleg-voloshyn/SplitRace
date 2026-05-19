class TournamentEventResource
  include Alba::Resource

  attributes :id, :event_type, :created_at

  attribute :title do |event|
    localized_text(event)[:title] || event.title
  end

  attribute :body do |event|
    localized_text(event)[:body] || event.body
  end

  attribute :actor do |event|
    {
      id: event.actor.id,
      display_name: event.actor.display_name,
      avatar_url: event.actor.profile_avatar_url
    }
  end

  attribute :segment do |event|
    event.segment && { id: event.segment.id, name: event.segment.name }
  end

  def localized_text(event)
    return {} unless event.event_type == 'segment_unlocked' && event.metadata.present?

    TournamentEventPublisher.localize_segment_unlocked(event.metadata, I18n.locale)
  end
end
