class MatchSegmentsJob < ApplicationJob
  queue_as :default

  def perform(activity_id)
    activity = Activity.find_by(id: activity_id)
    return unless activity

    score_changed_tournament_ids = SegmentMatcher.new(activity).call

    activity.user.tournaments.where(status: 'active', id: score_changed_tournament_ids).find_each do |tournament|
      TournamentScore.recalculate_all(tournament)
    end
  end
end
