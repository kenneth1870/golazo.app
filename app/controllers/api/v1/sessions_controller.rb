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
          role:     params[:role].presence || "user"
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
