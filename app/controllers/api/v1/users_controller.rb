module Api
  module V1
    class UsersController < BaseController
      def me
        render json: user_json(current_user)
      end

      def update_me
        if current_user.update(user_params)
          render json: user_json(current_user)
        else
          render json: { errors: current_user.errors.full_messages }, status: :unprocessable_content
        end
      end

      private

      def user_params
        params.permit(:first_name, :last_name, :gender, :units, :locale, :country, :city)
      end
    end
  end
end
