module Api
  module V1
    module Admin
      class UsersController < BaseController
        before_action :require_admin!
        before_action :find_user, only: %i[show update destroy]

        def index
          users = User.order(created_at: :desc).limit(200)
          render json: users.map { |u|
            u.as_json_public.merge(
              sign_in_count:    u.sign_in_count,
              last_sign_in_at:  u.last_sign_in_at,
              created_at:       u.created_at,
            )
          }
        end

        def show
          render json: @user.as_json_public.merge(
            sign_in_count:   @user.sign_in_count,
            last_sign_in_at: @user.last_sign_in_at,
            created_at:      @user.created_at,
          )
        end

        def update
          # Prevent the last admin from being demoted
          if @user.admin? && params[:role] == "user" && User.admin.count <= 1
            return render json: { error: "Cannot demote the last admin" }, status: :unprocessable_entity
          end

          if params.key?(:blocked)
            if @user == current_user
              return render json: { error: "Cannot block your own account" }, status: :unprocessable_entity
            end
            @user.blocked_at = ActiveModel::Type::Boolean.new.cast(params[:blocked]) ? Time.current : nil
          end

          @user.role = params[:role] if params.key?(:role)

          if @user.update(user_params)
            render json: @user.as_json_public
          else
            render json: { errors: @user.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def destroy
          if @user == current_user
            return render json: { error: "Cannot delete your own account" }, status: :unprocessable_entity
          end
          @user.destroy
          render json: { ok: true }
        end

        private

        def find_user
          @user = User.find(params[:id])
        end

        def user_params
          params.permit(:name, :email, :password, :password_confirmation)
        end
      end
    end
  end
end
