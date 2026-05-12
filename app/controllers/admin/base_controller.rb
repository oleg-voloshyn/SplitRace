class Admin::BaseController < ActionController::Base
  layout "admin"
  before_action :require_admin!

  include Rails.application.routes.url_helpers

  helper_method :admin_root_path, :admin_login_path, :admin_logout_path,
                :admin_segments_path, :new_admin_segment_path,
                :admin_segment_path, :edit_admin_segment_path,
                :admin_tournaments_path, :new_admin_tournament_path,
                :admin_tournament_path, :edit_admin_tournament_path,
                :activate_admin_tournament_path, :complete_admin_tournament_path,
                :add_segment_admin_tournament_path, :remove_segment_admin_tournament_path,
                :admin_users_path, :admin_user_path, :edit_admin_user_path,
                :admin_activities_path, :admin_activity_path,
                :admin_cheating_reports_path, :admin_cheating_report_path

  private

  def require_admin!
    @current_admin = User.find_by(id: session[:admin_user_id])
    unless @current_admin&.admin?
      session.delete(:admin_user_id)
      redirect_to admin_login_path, alert: "Please sign in as admin."
    end
  end
end
