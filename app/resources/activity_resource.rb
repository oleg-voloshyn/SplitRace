class ActivityResource
  include Alba::Resource

  attributes :id, :started_at, :finished_at, :distance_meters, :elapsed_time_seconds, :source

  attribute(:segment_efforts_count) { |a| a.segment_efforts.count }

  attribute :segment_efforts do |activity|
    efforts = activity.segment_efforts.includes(:segment).order(:started_at).to_a
    SegmentEffortResource.new(efforts).serializable_hash
  end

  attribute :passed_segments do |activity|
    ids = activity.passed_segment_ids.presence || []
    next [] if ids.empty?

    Segment.where(id: ids).pluck(:id, :name).map { |id, name| { id:, name: } }
  end

  attribute :pending_rated_unlocks do |activity|
    user = activity.user
    user.tournaments.where(status: 'active').filter_map do |tournament|
      rated = tournament.tournament_segments.where(is_rated: true).order(:order_number)
      next nil if rated.empty?

      rated_segment_ids    = rated.pluck(:segment_id)
      unlocked_in_activity = TournamentSegmentUnlock
                             .joins(:segment_effort)
                             .where(tournament:, user:)
                             .where(segment_efforts: { activity_id: activity.id })
                             .exists?
      next nil if unlocked_in_activity

      participant = tournament.participant_for(user)
      completed = TournamentScore
                  .unlocked_segment_ids_for(tournament, participant, segment_ids: rated_segment_ids)
                  .to_set
      next_required = rated.find { |ts| completed.exclude?(ts.segment_id) }
      next nil unless next_required

      { tournament_name: tournament.name, position: next_required.order_number }
    end
  end

  attribute :new_personal_bests do |activity|
    activity.segment_efforts.includes(:segment).filter_map do |effort|
      previous_best = SegmentEffort
                      .where(user_id: activity.user_id, segment_id: effort.segment_id)
                      .where.not(activity_id: activity.id)
                      .minimum(:elapsed_time_seconds)
      next nil unless previous_best
      next nil unless effort.elapsed_time_seconds < previous_best

      {
        segment_id: effort.segment_id,
        segment_name: effort.segment.name,
        elapsed_time_seconds: effort.elapsed_time_seconds,
        formatted_time: effort.formatted_time,
        previous_best_seconds: previous_best,
        previous_best_formatted: TimeFormatter.hms(previous_best)
      }
    end
  end

  attribute(:gps_points) { |a| a.gps_points || [] }
end
