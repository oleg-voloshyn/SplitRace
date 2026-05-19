class TournamentSegmentUnlock < ApplicationRecord
  belongs_to :tournament
  belongs_to :user
  belongs_to :segment
  belongs_to :tournament_segment
  belongs_to :segment_effort

  has_one :tournament_event, dependent: :nullify

  validates :position, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :unlocked_at, presence: true
  validates :segment_id, uniqueness: { scope: %i[tournament_id user_id] }
  validates :tournament_segment_id, uniqueness: { scope: %i[tournament_id user_id] }
  validate :tournament_segment_matches_unlock
  validate :segment_effort_matches_unlock
  validate :unlocked_inside_tournament_window

  def self.record!(tournament:, tournament_segment:, segment_effort:)
    find_or_create_by!(
      tournament:,
      user: segment_effort.user,
      segment: tournament_segment.segment
    ) do |unlock|
      unlock.tournament_segment = tournament_segment
      unlock.segment_effort = segment_effort
      unlock.position = tournament_segment.order_number
      unlock.unlocked_at = segment_effort.started_at
    end
  rescue ActiveRecord::RecordNotUnique
    find_by!(
      tournament:,
      user: segment_effort.user,
      segment: tournament_segment.segment
    )
  end

  private

  def tournament_segment_matches_unlock
    return unless tournament_segment && tournament && segment

    errors.add(:tournament_segment, 'must belong to tournament') if tournament_segment.tournament_id != tournament_id
    errors.add(:segment, 'must match tournament segment') if tournament_segment.segment_id != segment_id
  end

  def segment_effort_matches_unlock
    return unless segment_effort && user && segment

    errors.add(:segment_effort, 'must belong to user') if segment_effort.user_id != user_id
    errors.add(:segment_effort, 'must belong to segment') if segment_effort.segment_id != segment_id
  end

  def unlocked_inside_tournament_window
    participant = tournament&.participant_for(user)
    return unless tournament && user && unlocked_at

    unless participant
      errors.add(:user, 'must participate in tournament')
      return
    end

    return if SegmentEffort.started_in_tournament_window?(tournament, participant, unlocked_at)

    errors.add(:unlocked_at, 'must be inside tournament window')
  end
end
