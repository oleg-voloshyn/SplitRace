class Admin::SessionsController < ActionController::Base
  layout "admin"

  include Rails.application.routes.url_helpers
  helper_method :admin_root_path, :admin_login_path

  def new
    redirect_to admin_root_path if session[:admin_user_id]
  end

  def create
    user = User.find_by(email: params[:email].to_s.strip.downcase)
    if user&.admin? && user.authenticate(params[:password])
      session[:admin_user_id] = user.id
      redirect_to admin_root_path, notice: "Signed in."
    else
      flash.now[:alert] = "Invalid email or password."
      render :new, status: :unprocessable_entity
    end
  end

  def destroy
    session.delete(:admin_user_id)
    redirect_to admin_login_path
  end
end
