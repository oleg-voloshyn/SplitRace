class TournamentScore < ApplicationRecord
  belongs_to :user
  belongs_to :tournament

  # Golden Fever scoring:
  #   per completed rated segment: (fastest_same_gender_time / own_time) * 100
  #   first opener bonus: +10 for each rated segment where the runner is the
  #     first tournament participant to unlock it
  #   bonus for completing all segments in order:
  #     1st finisher: participants * 10, 2nd: * 9 … 10th: * 1
  def self.recalculate_all(tournament)
    rated_segments = tournament.tournament_segments
                               .where(is_rated: true)
                               .order(:order_number)
                               .includes(:segment)

    return if rated_segments.empty?

    rated_segment_ids  = rated_segments.map(&:segment_id)
    participants       = tournament.tournament_participants.includes(:user).to_a
    total_participants = participants.size
    first_opener_by_segment = first_opener_by_segment(tournament, rated_segment_ids)
    participant_contexts = participants.to_h do |tp|
      unlock_started_by_segment = unlock_started_by_segment(tournament, tp, segment_ids: rated_segment_ids)
      best_efforts_by_segment = best_efforts_for(
        tournament,
        tp,
        segment_ids: rated_segment_ids,
        unlock_started_by_segment:
      ).index_by(&:segment_id)

      [
        tp.user_id,
        {
          user: tp.user,
          unlock_started_by_segment:,
          best_efforts_by_segment:
        }
      ]
    end

    # Find who completed ALL segments and when (for bonus ranking)
    completion_times = {}
    participants.each do |tp|
      unlock_started_by_segment = participant_contexts.fetch(tp.user_id).fetch(:unlock_started_by_segment)
      done = unlock_started_by_segment.size

      next unless done == rated_segment_ids.size

      completion_times[tp.user_id] = rated_segment_ids.map { |segment_id| unlock_started_by_segment[segment_id] }.max
    end

    # 0-based rank among completers sorted by completion time
    completers_ranked = completion_times
                        .sort_by { |_, t| t }
                        .each_with_index
                        .to_h { |(user_id, _), idx| [user_id, idx] }

    participants.each do |tp|
      user   = tp.user
      gender = user.gender
      context = participant_contexts.fetch(tp.user_id)

      total_score     = 0.0
      completed_count = context.fetch(:unlock_started_by_segment).size

      rated_segments.each do |ts|
        best_effort = context.fetch(:best_efforts_by_segment)[ts.segment_id]

        next unless best_effort

        # Fastest time for this segment among tournament participants of same gender
        fastest = participant_contexts.values.filter_map do |candidate_context|
          next if gender.present? && candidate_context.fetch(:user).gender != gender

          candidate_context.fetch(:best_efforts_by_segment)[ts.segment_id]&.elapsed_time_seconds
        end.min

        if fastest && best_effort.elapsed_time_seconds.positive?
          total_score += (fastest.to_f / best_effort.elapsed_time_seconds) * 100.0
        end

        total_score += 10.0 if first_opener_by_segment[ts.segment_id] == user.id
      end

      # Bonus for completing all segments (positions 1–10)
      if (rank = completers_ranked[user.id])
        multiplier = [10 - rank, 0].max
        total_score += total_participants * multiplier if multiplier.positive?
      end

      record = find_or_initialize_by(user:, tournament:)
      record.update!(
        completed_segments_count: completed_count,
        score: total_score.round(2),
        total_time_seconds: nil
      )
    end

    update_ranks(tournament)
  end

  def self.first_opener_by_segment(tournament, segment_ids)
    return {} if segment_ids.empty?

    tournament.tournament_segment_unlocks
      .where(segment_id: segment_ids)
      .order(:segment_id, :unlocked_at, :id)
      .pluck(:segment_id, :user_id)
      .each_with_object({}) do |(segment_id, user_id), first_openers|
        first_openers[segment_id] ||= user_id
      end
  end

  def self.eligible_unlocks_for(tournament, participant, segment_ids:)
    return TournamentSegmentUnlock.none unless participant

    tournament.tournament_segment_unlocks
              .where(user_id: participant.user_id, segment_id: segment_ids)
  end

  def self.unlock_started_by_segment(tournament, participant, segment_ids:)
    eligible_unlocks_for(tournament, participant, segment_ids:)
      .order(:unlocked_at, :id)
      .pluck(:segment_id, :unlocked_at)
      .each_with_object({}) do |(segment_id, unlocked_at), unlocks|
        unlocks[segment_id] ||= unlocked_at
      end
  end

  def self.unlocked_segment_ids_for(tournament, participant, segment_ids:)
    unlock_started_by_segment(tournament, participant, segment_ids:).keys
  end

  def self.best_efforts_for(tournament, participant, segment_ids:, unlock_started_by_segment: nil)
    return [] unless participant

    unlock_started_by_segment ||= self.unlock_started_by_segment(tournament, participant, segment_ids:)
    return [] if unlock_started_by_segment.empty?

    SegmentEffort
      .in_tournament_window(tournament, participant)
      .where(user_id: participant.user_id, segment_id: unlock_started_by_segment.keys)
      .order(:segment_id, :elapsed_time_seconds, :started_at, :id)
      .select do |effort|
        effort.started_at >= unlock_started_by_segment.fetch(effort.segment_id)
      end
      .uniq(&:segment_id)
  end

  def self.update_ranks(tournament)
    tournament.tournament_scores
              .where('score > 0')
              .order(score: :desc)
              .each_with_index { |s, i| s.update_columns(rank: i + 1) }

    User::GENDERS.each do |gender|
      tournament.tournament_scores
                .joins(:user)
                .where(users: { gender: })
                .where('score > 0')
                .order(score: :desc)
                .each_with_index { |s, i| s.update_columns(gender_rank: i + 1) }
    end
  end
end
