module Admin
  class UsersController < Admin::BaseController
    def index
      @sort = params[:sort].presence_in(%w[name email role gender created_at]) || 'created_at'
      @direction = sort_direction
      @query = params[:q].to_s.strip

      scope = User.includes(:oauth_identities)
      if @query.present?
        pattern = "%#{ActiveRecord::Base.sanitize_sql_like(@query)}%"
        scope = scope.where(
          'users.email ILIKE :q OR users.first_name ILIKE :q OR users.last_name ILIKE :q OR users.role ILIKE :q OR users.city ILIKE :q OR users.country ILIKE :q',
          q: pattern
        )
      end

      scope = scope.order(user_sort_order)
      @pagy, @users = pagy(scope)
    end

    def edit
      @user = User.find(params[:id])
    end

    def update
      @user = User.find(params[:id])
      if @user.update(user_params)
        redirect_to admin_users_path, notice: "#{@user.full_name} updated."
      else
        render :edit, status: :unprocessable_content
      end
    end

    private

    def user_params
      params.require(:user).permit(:role)
    end

    def user_sort_order
      column = case @sort
               when 'name' then "LOWER(COALESCE(users.first_name, '') || ' ' || COALESCE(users.last_name, ''))"
               when 'email' then 'users.email'
               when 'role' then 'users.role'
               when 'gender' then 'users.gender'
               else 'users.created_at'
               end

      Arel.sql("#{column} #{@direction}, users.id desc")
    end
  end
end
