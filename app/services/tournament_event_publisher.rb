class TournamentEventPublisher
  def self.segment_unlocked!(tournament:, segment_effort:)
    segment = segment_effort.segment
    actor = segment_effort.user
    title = "#{actor.display_name} opened #{segment.name}"
    body = "#{actor.display_name} completed #{segment.name} in #{segment_effort.formatted_time}."

    event = TournamentEvent.create!(
      tournament:,
      actor:,
      segment:,
      segment_effort:,
      event_type: 'segment_unlocked',
      title:,
      body:,
      metadata: {
        elapsed_time_seconds: segment_effort.elapsed_time_seconds,
        segment_name: segment.name,
        actor_name: actor.display_name
      }
    )

    tournament.tournament_participants.includes(:user).find_each do |participant|
      notification = participant.user.notifications.create!(
        tournament:,
        tournament_event: event,
        notification_type: event.event_type,
        title: event.title,
        body: event.body
      )
      ExpoPushNotificationService.deliver(notification)
    end

    event
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
    nil
  end
end
