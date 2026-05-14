module Admin
  class BaseController < ActionController::Base
    PER_PAGE = 25

    layout 'admin'
    before_action :require_admin!

    include Rails.application.routes.url_helpers

    helper_method :admin_root_path, :admin_login_path, :admin_logout_path,
                  :admin_segments_path, :new_admin_segment_path,
                  :admin_segment_path, :edit_admin_segment_path,
                  :admin_tournaments_path, :new_admin_tournament_path,
                  :admin_tournament_path, :edit_admin_tournament_path,
                  :activate_admin_tournament_path, :approve_admin_tournament_path,
                  :reject_admin_tournament_path, :complete_admin_tournament_path,
                  :add_segment_admin_tournament_path, :remove_segment_admin_tournament_path,
                  :admin_users_path, :admin_user_path, :edit_admin_user_path,
                  :admin_activities_path, :admin_activity_path,
                  :admin_cheating_reports_path, :admin_cheating_report_path
    helper_method :pending_tournament_review_count

    private

    def paginate(scope)
      @page = params.fetch(:page, 1).to_i
      @page = 1 if @page < 1
      @per_page = PER_PAGE
      @total_count = scope.except(:select, :order, :limit, :offset).count
      @total_pages = (@total_count.to_f / @per_page).ceil
      @total_pages = 1 if @total_pages < 1
      @page = @total_pages if @page > @total_pages

      scope.limit(@per_page).offset((@page - 1) * @per_page)
    end

    def sort_direction
      params[:direction] == 'asc' ? 'asc' : 'desc'
    end

    def require_admin!
      @current_admin = User.find_by(id: session[:admin_user_id])
      unless @current_admin&.admin?
        session.delete(:admin_user_id)
        redirect_to admin_login_path, alert: 'Please sign in as admin.'
      end
    end

    def pending_tournament_review_count
      @pending_tournament_review_count ||= Tournament.pending_review.count
    end
  end
end
