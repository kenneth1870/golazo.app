module Api
  module V1
    class PushSubscriptionsController < BaseController
      # POST /api/v1/push_subscriptions
      # Body: { endpoint, p256dh, auth, device_id, team_ids: [] }
      def create
        endpoint = params[:endpoint].to_s.strip
        return render json: { error: "Missing endpoint" }, status: :unprocessable_entity if endpoint.blank?

        sub = PushSubscription.find_or_initialize_by(endpoint: endpoint)
        sub.assign_attributes(
          p256dh:    params[:p256dh].to_s,
          auth:      params[:auth].to_s,
          device_id: params[:device_id].to_s.presence,
          team_ids:  (params[:team_ids] || []).to_json,
        )

        if sub.save
          render json: { ok: true, id: sub.id }, status: (sub.previously_new_record? ? :created : :ok)
        else
          render json: { error: sub.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/push_subscriptions/:id/teams
      # Updates the team_ids list for a subscription
      def update_teams
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        return render json: { error: "Not found" }, status: :not_found unless sub

        sub.update!(team_ids: (params[:team_ids] || []).to_json)
        render json: { ok: true, team_ids: sub.team_names }
      end

      # DELETE /api/v1/push_subscriptions
      # Body: { endpoint }
      def destroy
        sub = PushSubscription.find_by(endpoint: params[:endpoint])
        sub&.destroy
        render json: { ok: true }
      end

      # GET /api/v1/vapid_public_key — returns the public key so the frontend can subscribe
      def vapid_key
        render json: { key: ENV["VAPID_PUBLIC_KEY"].to_s }
      end
    end
  end
end
