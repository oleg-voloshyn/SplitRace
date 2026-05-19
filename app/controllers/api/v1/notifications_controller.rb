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
          items: records.map { |notification| notification_json(notification) },
          pagy: pagy_meta(pagy)
        }
      end

      def read
        notification = current_user.notifications.find(params[:id])
        notification.mark_read!
        render json: notification_json(notification)
      end

      def read_all
        current_user.notifications.unread.update_all(read_at: Time.current, updated_at: Time.current)
        render json: { unread_count: 0 }
      end

      private

      def notification_json(notification)
        {
          id: notification.id,
          notification_type: notification.notification_type,
          title: notification.title,
          body: notification.body,
          read_at: notification.read_at,
          created_at: notification.created_at,
          tournament: notification.tournament && {
            id: notification.tournament.id,
            name: notification.tournament.name,
            slug: notification.tournament.slug
          }
        }
      end
    end
  end
end
