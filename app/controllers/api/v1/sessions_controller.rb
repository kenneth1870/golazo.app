require "net/http"

module Api
  module V1
    class SessionsController < BaseController
      before_action :require_user!, only: %i[me logout]

      # POST /api/v1/sessions — login
      def create
        user = User.find_by(email: params[:email].to_s.downcase.strip)
        if user&.authenticate(params[:password])
          user.update_columns(
            last_sign_in_at: Time.current,
            sign_in_count:   user.sign_in_count + 1
          )
          render json: { token: user.generate_token, user: user.as_json_public }
        else
          render json: { error: "Invalid email or password" }, status: :unauthorized
        end
      end

      # GET /api/v1/sessions/me — return current user from token
      def me
        render json: { user: current_user.as_json_public }
      end

      # DELETE /api/v1/sessions — logout (client-side: just drop the token)
      def logout
        render json: { ok: true }
      end

      # POST /api/v1/sessions/google — sign in / sign up via Google ID token
      def google
        id_token = params[:credential].to_s.strip
        return render json: { error: "missing credential" }, status: :unprocessable_entity if id_token.blank?

        # Verify with Google's tokeninfo endpoint — no extra gem needed
        uri  = URI("https://oauth2.googleapis.com/tokeninfo?id_token=#{URI.encode_www_form_component(id_token)}")
        resp = Net::HTTP.get_response(uri)
        return render json: { error: "invalid token" }, status: :unauthorized unless resp.is_a?(Net::HTTPOK)

        payload = JSON.parse(resp.body)

        # Validate audience when client ID is configured
        client_id = ENV["GOOGLE_CLIENT_ID"].to_s.strip
        if client_id.present? && payload["aud"] != client_id
          return render json: { error: "token audience mismatch" }, status: :unauthorized
        end

        email = payload["email"].to_s.downcase.strip
        name  = payload["name"].to_s.strip.presence || email.split("@").first
        return render json: { error: "no email in token" }, status: :unprocessable_entity if email.blank?

        user = User.find_by(email: email) || User.create!(
          email:    email,
          name:     name,
          password: SecureRandom.hex(24),
          role:     User.count.zero? ? :admin : :user
        )

        user.update_columns(
          last_sign_in_at: Time.current,
          sign_in_count:   user.sign_in_count + 1
        )

        render json: { token: user.generate_token, user: user.as_json_public }
      rescue => e
        Rails.logger.error("[Sessions#google] #{e.message}")
        render json: { error: "authentication failed" }, status: :internal_server_error
      end

      # POST /api/v1/sessions/register — create account (admin-invite only: must supply admin token)
      def register
        # Only admins (or the first user if table is empty) can create accounts
        unless User.count.zero? || current_user&.admin?
          return render json: { error: "forbidden" }, status: :forbidden
        end

        user = User.new(
          email:    params[:email],
          name:     params[:name],
          password: params[:password],
          password_confirmation: params[:password_confirmation],
          role:     "user"
        )
        if user.save
          render json: { token: user.generate_token, user: user.as_json_public }, status: :created
        else
          render json: { errors: user.errors.full_messages }, status: :unprocessable_entity
        end
      end
    end
  end
end
