class User < ApplicationRecord
  has_secure_password

  enum :role, { user: 0, admin: 1 }, default: :user

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  validates :password, length: { minimum: 8 }, allow_nil: true

  before_save { self.email = email.downcase.strip }

  # JWT helpers — kept on the model so controllers stay thin
  JWT_SECRET  = ENV.fetch("JWT_SECRET", Rails.application.secret_key_base)
  JWT_EXPIRY  = 30.days

  def generate_token
    payload = {
      sub:  id,
      role: role,
      iat:  Time.now.to_i,
      exp:  JWT_EXPIRY.from_now.to_i
    }
    JWT.encode(payload, JWT_SECRET, "HS256")
  end

  def self.from_token(token)
    return nil if token.blank?
    payload = JWT.decode(token, JWT_SECRET, true, algorithms: [ "HS256" ]).first
    find_by(id: payload["sub"])
  rescue JWT::DecodeError
    nil
  end

  def as_json_public
    { id:, email:, name:, role: }
  end
end
