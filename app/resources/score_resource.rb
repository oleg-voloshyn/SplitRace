class ScoreResource
  include Alba::Resource

  # Required params:
  #   rank              — page-aware rank for this row
  #   tournament        — the tournament being ranked
  #   rated_segments    — ordered TournamentSegment relation (where is_rated)
  #   rated_segment_ids — pluck of segment_ids from above
  #   first_openers     — hash of segment_id => first-opener user_id

  attribute(:rank)         { params[:rank] }
  attribute :overall_rank, &:rank
  attribute :gender_rank,  &:gender_rank

  attribute :user do |score|
    {
      id: score.user.id,
      full_name: score.user.full_name,
      avatar_url: score.user.profile_avatar_url,
      gender: score.user.gender
    }
  end

  attribute :total_time_seconds do |score|
    best_efforts(score).sum(&:elapsed_time_seconds)
  end

  attribute :completed_segments, &:completed_segments_count
  attribute(:rated_segments_count) { params[:rated_segment_ids].size }

  attribute :next_required_position do |score|
    completed = best_efforts(score).to_set(&:segment_id)
    params[:rated_segments].find { |ts| completed.exclude?(ts.segment_id) }&.order_number
  end

  attribute :first_opener_bonus_count do |score|
    completed = best_efforts(score).to_set(&:segment_id)
    completed.count { |sid| params[:first_openers][sid] == score.user_id }
  end

  attribute :last_unlock_at do |score|
    participant = participant_for(score)
    next nil unless participant

    TournamentScore
      .eligible_unlocks_for(params[:tournament], participant, segment_ids: params[:rated_segment_ids])
      .maximum(:unlocked_at)
  end

  attribute(:rank_delta) { nil }
  attribute :score, &:score

  def best_efforts(score)
    @best_efforts ||= {}
    @best_efforts[score.id] ||= begin
      participant = participant_for(score)
      if participant
        TournamentScore.best_efforts_for(params[:tournament], participant, segment_ids: params[:rated_segment_ids])
      else
        []
      end
    end
  end

  def participant_for(score)
    participants_by_user_id[score.user_id] || params[:tournament].participant_for(score.user)
  end

  def participants_by_user_id
    @participants_by_user_id ||= params[:participants_by_user_id] || {}
  end
end
