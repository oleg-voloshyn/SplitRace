module Api
  module V1
    class AuthController < ActionController::API
      def register
        user = User.new(register_params)
        if user.save
          token = JwtService.encode(user_id: user.id)
          render json: { token:, user: user_json(user) }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_content
        end
      end

      def login
        user = User.find_by(email: params[:email]&.downcase)
        if user&.authenticate(params[:password])
          token = JwtService.encode(user_id: user.id)
          render json: { token:, user: user_json(user) }
        else
          render json: { error: 'Invalid email or password' }, status: :unauthorized
        end
      end

      private

      def register_params
        params.permit(:email, :password, :password_confirmation, :first_name, :last_name, :gender, :locale, :units)
      end

      def user_json(user)
        {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          gender: user.gender,
          role: user.role,
          units: user.units,
          locale: user.locale
        }
      end
    end
  end
end
