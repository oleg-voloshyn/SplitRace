module Api
  module V1
    class AuthController < ActionController::API
      def register
        user = User.new(register_params)
        if user.save
          token = JwtService.encode(user_id: user.id)
          render json: { token:, user: UserResource.new(user).serializable_hash }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_content
        end
      end

      def login
        user = User.find_by(email: params[:email]&.downcase)
        if user&.authenticate(params[:password])
          token = JwtService.encode(user_id: user.id)
          render json: { token:, user: UserResource.new(user).serializable_hash }
        else
          render json: { error: 'Invalid email or password' }, status: :unauthorized
        end
      end

      def google
        payload = GoogleIdentityTokenVerifier.new.verify!(params[:id_token])
        user = find_or_create_google_user!(payload)
        token = JwtService.encode(user_id: user.id)

        render json: { token:, user: UserResource.new(user).serializable_hash }
      rescue GoogleIdentityTokenVerifier::Error => e
        render json: { error: e.message }, status: :unauthorized
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
      end

      def apple
        payload = AppleIdentityTokenVerifier.new.verify!(params[:identity_token])
        user = find_or_create_apple_user!(payload, params.slice(:first_name, :last_name))
        token = JwtService.encode(user_id: user.id)

        render json: { token:, user: UserResource.new(user).serializable_hash }
      rescue AppleIdentityTokenVerifier::Error => e
        render json: { error: e.message }, status: :unauthorized
      rescue ActiveRecord::RecordInvalid => e
        render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
      end

      private

      def register_params
        params.permit(:email, :password, :password_confirmation, :first_name, :last_name, :gender, :locale, :units,
                      :account_type, :club_name)
      end

      def find_or_create_google_user!(payload)
        identity = OauthIdentity.find_by(provider: 'google_oauth2', uid: payload['sub'])
        return ensure_runner!(identity.user) if identity

        user = User.find_by(email: payload['email'].downcase)
        user = ensure_runner!(user) if user
        user ||= User.new(
          email: payload['email'].downcase,
          first_name: payload['given_name'],
          last_name: payload['family_name'],
          avatar_url: payload['picture'],
          account_type: 'user'
        )

        identity_attrs = {
          provider: 'google_oauth2',
          uid: payload['sub'],
          token_expires_at: token_expires_at(payload)
        }

        if user.new_record?
          user.oauth_identities.build(identity_attrs)
          user.save!
        else
          user.oauth_identities.create!(identity_attrs)
        end

        user
      end

      def find_or_create_apple_user!(payload, name_params = {})
        identity = OauthIdentity.find_by(provider: 'apple', uid: payload['sub'])
        return ensure_runner!(identity.user) if identity

        email = payload['email']&.downcase
        user = User.find_by(email:) if email
        user = ensure_runner!(user) if user
        user ||= User.new(
          email:,
          first_name: name_params[:first_name].presence,
          last_name: name_params[:last_name].presence,
          account_type: 'user'
        )

        identity_attrs = { provider: 'apple', uid: payload['sub'], token_expires_at: token_expires_at(payload) }

        if user.new_record?
          user.oauth_identities.build(identity_attrs)
          user.save!
        else
          user.oauth_identities.create!(identity_attrs)
        end

        user
      end

      def ensure_runner!(user)
        return user unless user.club?

        user.errors.add(:base, 'Social sign-in is only available for runners, not clubs')
        raise ActiveRecord::RecordInvalid, user
      end

      def token_expires_at(payload)
        expires_at = payload['exp'].presence
        Time.zone.at(expires_at.to_i) if expires_at
      end
    end
  end
end
