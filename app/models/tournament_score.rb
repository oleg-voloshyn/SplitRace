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
    participants       = tournament.tournament_participants.includes(:user)
    total_participants = participants.count
    first_opener_by_segment = first_opener_by_segment(tournament, rated_segment_ids)

    # Find who completed ALL segments and when (for bonus ranking)
    completion_times = {}
    participants.each do |tp|
      done = SegmentEffort
             .where(user: tp.user, segment_id: rated_segment_ids)
             .select(:segment_id).distinct.count

      next unless done == rated_segment_ids.size

      last_effort = SegmentEffort
                    .where(user: tp.user, segment_id: rated_segment_ids)
                    .order(:started_at)
                    .last
      completion_times[tp.user_id] = last_effort.started_at
    end

    # 0-based rank among completers sorted by completion time
    completers_ranked = completion_times
                        .sort_by { |_, t| t }
                        .each_with_index
                        .to_h { |(user_id, _), idx| [user_id, idx] }

    participants.each do |tp|
      user   = tp.user
      gender = user.gender

      total_score     = 0.0
      completed_count = 0

      rated_segments.each do |ts|
        best_effort = SegmentEffort
                      .where(user:, segment_id: ts.segment_id)
                      .order(:elapsed_time_seconds)
                      .first

        next unless best_effort

        completed_count += 1

        # Fastest time for this segment among tournament participants of same gender
        fastest_q = SegmentEffort
                    .joins(user: :tournament_participants)
                    .where(tournament_participants: { tournament_id: tournament.id })
                    .where(segment_id: ts.segment_id)
        fastest_q = fastest_q.where(users: { gender: }) if gender.present?
        fastest   = fastest_q.minimum(:elapsed_time_seconds)

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

    participant_user_ids = tournament.tournament_participants.select(:user_id)

    SegmentEffort
      .where(user_id: participant_user_ids, segment_id: segment_ids)
      .order(:segment_id, :started_at, :id)
      .pluck(:segment_id, :user_id)
      .each_with_object({}) do |(segment_id, user_id), first_openers|
        first_openers[segment_id] ||= user_id
      end
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
