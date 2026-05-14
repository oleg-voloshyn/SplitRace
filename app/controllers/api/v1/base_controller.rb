module Api
  module V1
    class BaseController < ActionController::API
      before_action :authenticate_user!

      private

      def authenticate_user!
        token = request.headers['Authorization']&.split&.last
        return render_unauthorized unless token

        payload = JwtService.decode(token)
        return render_unauthorized unless payload

        @current_user = User.find_by(id: payload['user_id'])
        render_unauthorized unless @current_user
      end

      attr_reader :current_user

      def require_admin!
        render json: { error: 'Forbidden' }, status: :forbidden unless current_user.admin?
      end

      def require_moderator!
        render json: { error: 'Forbidden' }, status: :forbidden unless current_user.moderator?
      end

      def render_unauthorized
        render json: { error: 'Unauthorized' }, status: :unauthorized
      end

      def user_json(user)
        {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          avatar_url: user.profile_avatar_url,
          gender: user.gender,
          role: user.role,
          units: user.units,
          locale: user.locale,
          country: user.country,
          city: user.city,
          providers: user.oauth_identities.pluck(:provider)
        }
      end
    end
  end
end
