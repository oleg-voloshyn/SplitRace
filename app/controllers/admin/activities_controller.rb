class Admin::ActivitiesController < Admin::BaseController
  def index
    scope = Activity.includes(:user, :segment_efforts).order(started_at: :desc)
    scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
    @user       = User.find(params[:user_id]) if params[:user_id].present?
    @activities = scope.limit(200)
  end

  def show
    @activity = Activity.includes(:user, segment_efforts: :segment).find(params[:id])
  end
end
