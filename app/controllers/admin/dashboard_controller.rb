class Admin::DashboardController < Admin::BaseController
  def index
    @stats = {
      users:       User.count,
      segments:    Segment.count,
      tournaments: Tournament.count,
      activities:  Activity.count,
    }
    @recent_tournaments = Tournament.order(created_at: :desc).limit(5)
    @recent_segments    = Segment.order(created_at: :desc).limit(5)
  end
end
