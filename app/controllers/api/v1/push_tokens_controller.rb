module Api
  module V1
    class PushTokensController < BaseController
      def create
        push_token = DevicePushToken.find_or_initialize_by(token: push_token_params[:token])
        push_token.assign_attributes(
          user: current_user,
          platform: push_token_params[:platform],
          last_registered_at: Time.current,
          disabled_at: nil
        )
        push_token.save!

        render json: { registered: true }
      end

      def destroy
        token = current_user.device_push_tokens.find_by(token: params[:token])
        token&.disable!

        render json: { registered: false }
      end

      private

      def push_token_params
        params.require(:push_token).permit(:token, :platform)
      end
    end
  end
end
