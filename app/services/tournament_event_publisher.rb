class TournamentEventPublisher
  def self.segment_unlocked!(unlock: nil, tournament: nil, segment_effort: nil)
    unlock ||= record_unlock!(tournament:, segment_effort:)
    return unless unlock
    return unlock.tournament_event if unlock.tournament_event

    tournament = unlock.tournament
    segment_effort = unlock.segment_effort
    segment = unlock.segment
    actor   = unlock.user

    metadata = {
      elapsed_time_seconds: segment_effort.elapsed_time_seconds,
      formatted_time: segment_effort.formatted_time,
      segment_name: segment.name,
      actor_name: actor.display_name,
      position: unlock.position
    }

    # Default-locale text is stored on the event so DB validations pass and
    # legacy consumers still see human-readable strings. Per-request feed
    # rendering re-localizes from `metadata` using the viewer's locale.
    default_text = localize_segment_unlocked(metadata, I18n.default_locale)

    event = TournamentEvent.create!(
      tournament:,
      actor:,
      segment:,
      segment_effort:,
      tournament_segment_unlock: unlock,
      event_type: 'segment_unlocked',
      title: default_text[:title],
      body: default_text[:body],
      metadata:
    )

    tournament.tournament_participants.includes(:user).find_each do |participant|
      recipient = participant.user
      next if recipient.id == actor.id

      text = localize_segment_unlocked(metadata, recipient.locale)
      notification = recipient.notifications.create!(
        tournament:,
        tournament_event: event,
        notification_type: event.event_type,
        title: text[:title],
        body: text[:body]
      )
      ExpoPushNotificationService.deliver(notification)
    end

    event
  rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
    nil
  end

  def self.record_unlock!(tournament:, segment_effort:)
    return unless tournament && segment_effort

    tournament_segment = tournament.tournament_segments.find_by!(segment_id: segment_effort.segment_id)
    TournamentSegmentUnlock.record!(tournament:, tournament_segment:, segment_effort:)
  end

  def self.localize_segment_unlocked(metadata, locale)
    locale = locale&.to_sym
    locale = I18n.default_locale unless I18n.available_locales.include?(locale)
    I18n.with_locale(locale) do
      {
        title: I18n.t('notifications.segment_unlocked.title',
                      actor: metadata[:actor_name] || metadata['actor_name'],
                      segment: metadata[:segment_name] || metadata['segment_name']),
        body: I18n.t('notifications.segment_unlocked.body',
                     actor: metadata[:actor_name] || metadata['actor_name'],
                     segment: metadata[:segment_name] || metadata['segment_name'],
                     time: metadata[:formatted_time] || metadata['formatted_time'])
      }
    end
  end
end
