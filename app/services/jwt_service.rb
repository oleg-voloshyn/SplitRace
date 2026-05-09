class JwtService
  SECRET = Rails.application.secret_key_base
  TTL    = 30.days

  def self.encode(payload)
    JWT.encode(payload.merge(exp: TTL.from_now.to_i), SECRET, "HS256")
  end

  def self.decode(token)
    JWT.decode(token, SECRET, true, algorithm: "HS256").first
  rescue JWT::DecodeError
    nil
  end
end
