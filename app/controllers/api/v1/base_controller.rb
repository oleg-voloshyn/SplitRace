module Api
  module V1
    class BaseController < ActionController::API
      include Pagy::Backend

      before_action :authenticate_user!
      around_action :switch_locale

      private

      def paginated(scope, **, &block)
        pagy, records = pagy(scope, **)
        items = block ? records.map(&block) : records
        { items:, pagy: pagy_meta(pagy) }
      end

      def pagy_meta(pagy)
        {
          page: pagy.page,
          pages: pagy.pages,
          count: pagy.count,
          limit: pagy.limit,
          next: pagy.next,
          prev: pagy.prev
        }
      end

      def authenticate_user!
        token = request.headers['Authorization']&.split&.last
        return render_unauthorized unless token

        payload = JwtService.decode(token)
        return render_unauthorized unless payload

        @current_user = User.find_by(id: payload['user_id'])
        render_unauthorized unless @current_user
      end

      def switch_locale(&)
        locale = current_user&.locale&.to_sym
        locale = I18n.default_locale unless I18n.available_locales.include?(locale)
        I18n.with_locale(locale, &)
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
        UserResource.new(user, params: { detailed: true }).serializable_hash
      end
    end
  end
end
