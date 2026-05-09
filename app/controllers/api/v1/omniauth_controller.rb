module Api
  module V1
    class OmniauthController < ActionController::API
      def callback
        auth = request.env["omniauth.auth"]
        return render json: { error: "OAuth failed" }, status: :unprocessable_entity unless auth

        identity = OauthIdentity.find_by(provider: auth.provider, uid: auth.uid.to_s)

        if identity
          user = identity.user
          identity.update(
            access_token:     auth.credentials.token,
            refresh_token:    auth.credentials.refresh_token,
            token_expires_at: auth.credentials.expires_at ? Time.at(auth.credentials.expires_at) : nil
          )
        else
          user = User.find_by(email: auth.info.email&.downcase) ||
                 User.new(
                   email:      auth.info.email&.downcase,
                   first_name: auth.info.first_name || auth.info.name&.split(" ")&.first,
                   last_name:  auth.info.last_name  || auth.info.name&.split(" ")&.last,
                   avatar_url: auth.info.image
                 )

          identity_attrs = {
            provider:         auth.provider,
            uid:              auth.uid.to_s,
            access_token:     auth.credentials.token,
            refresh_token:    auth.credentials.refresh_token,
            token_expires_at: auth.credentials.expires_at ? Time.at(auth.credentials.expires_at) : nil
          }

          if user.new_record?
            # Build identity before save so the validation passes
            user.oauth_identities.build(identity_attrs)
            user.save!
          else
            user.oauth_identities.create!(identity_attrs)
          end
        end

        token = JwtService.encode(user_id: user.id)
        frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
        redirect_to "#{frontend_url}/oauth/callback?token=#{token}", allow_other_host: true
      end

      def failure
        frontend_url = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
        redirect_to "#{frontend_url}/oauth/callback?error=oauth_failed", allow_other_host: true
      end
    end
  end
end
