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
    params[:tournament].tournament_events
                       .where(actor: score.user, event_type: 'segment_unlocked')
                       .maximum(:created_at)
  end

  attribute(:rank_delta) { nil }
  attribute :score, &:score

  def best_efforts(score)
    @best_efforts ||= SegmentEffort
                      .where(user: score.user, segment_id: params[:rated_segment_ids])
                      .order(:segment_id, :elapsed_time_seconds)
                      .to_a
                      .uniq(&:segment_id)
  end
end
