class SetupController < ActionController::API
  def admin
    secret = ENV["SETUP_SECRET"]
    return render json: { error: "forbidden" }, status: :forbidden if secret.blank? || params[:secret] != secret

    user = User.find_by(email: ENV["ADMIN_EMAIL"])
    return render json: { error: "user not found" }, status: :not_found unless user

    password = SecureRandom.hex(10)
    user.update!(role: "admin", password: password)
    render json: { ok: true, email: user.email, password: password }
  end
end
