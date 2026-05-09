class TournamentScore < ApplicationRecord
  belongs_to :user
  belongs_to :tournament

  def self.recalculate_all(tournament)
    participants = tournament.tournament_participants.includes(:user)
    rated_segment_ids = tournament.tournament_segments.where(is_rated: true).pluck(:segment_id)

    participants.each do |participant|
      best_efforts = SegmentEffort
        .where(user: participant.user, segment_id: rated_segment_ids)
        .group(:segment_id)
        .minimum(:elapsed_time_seconds)

      total_time = best_efforts.values.sum
      completed  = best_efforts.size

      score = find_or_initialize_by(user: participant.user, tournament: tournament)
      score.update!(
        total_time_seconds:       total_time.positive? ? total_time : nil,
        completed_segments_count: completed,
        score:                    completed.positive? ? completed.to_f / rated_segment_ids.size : 0.0
      )
    end

    update_ranks(tournament)
  end

  def self.update_ranks(tournament)
    scores = tournament.tournament_scores
      .where.not(total_time_seconds: nil)
      .order(:total_time_seconds)

    scores.each_with_index do |score, i|
      score.update_columns(rank: i + 1)
    end

    User::GENDERS.each do |gender|
      gender_scores = tournament.tournament_scores
        .joins(:user)
        .where(users: { gender: gender })
        .where.not(total_time_seconds: nil)
        .order(:total_time_seconds)

      gender_scores.each_with_index do |score, i|
        score.update_columns(gender_rank: i + 1)
      end
    end
  end
end
