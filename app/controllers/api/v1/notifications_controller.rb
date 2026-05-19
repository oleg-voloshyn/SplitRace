module Api
  module V1
    class NotificationsController < BaseController
      def index
        scope = current_user.notifications
                            .includes(:tournament)
                            .order(created_at: :desc)

        pagy, records = pagy(scope)
        render json: {
          unread_count: current_user.notifications.unread.count,
          items: NotificationResource.new(records.to_a).serializable_hash,
          pagy: pagy_meta(pagy)
        }
      end

      def read
        notification = current_user.notifications.find(params[:id])
        notification.mark_read!
        render json: NotificationResource.new(notification).serializable_hash
      end

      def read_all
        current_user.notifications.unread.update_all(read_at: Time.current, updated_at: Time.current)
        render json: { unread_count: 0 }
      end
    end
  end
end
