module Api
  module V1
    class PredictionsController < BaseController
      def show
        pred = Prediction.find_or_initialize_by(match_external_id: params[:match_id])
        render json: pred.new_record? ? empty_result(params[:match_id]) : pred.as_json_result
      end

      def vote
        # Rate-limit: one vote per device+IP per match per 24 hours.
        # Include device_id alongside IP so X-Forwarded-For spoofing on shared
        # proxies can't bypass the limit — both keys must be fresh to block.
        device_id = params[:device_id].to_s.strip.first(64).presence || "anon"
        ip_key     = "vote_ip_#{request.remote_ip}_#{params[:match_id]}"
        device_key = "vote_dev_#{device_id}_#{params[:match_id]}"
        if Rails.cache.read(ip_key) || Rails.cache.read(device_key)
          return render json: { error: "already_voted" }, status: :unprocessable_entity
        end

        # find_or_create_by! is not atomic — two concurrent first-votes on the
        # same match both see no row, both INSERT, one gets RecordNotUnique.
        # Rescue and fall back to a plain find so the vote still goes through.
        pred = begin
          Prediction.find_or_create_by!(match_external_id: params[:match_id])
        rescue ActiveRecord::RecordNotUnique
          Prediction.find_by!(match_external_id: params[:match_id])
        end
        token  = params[:token].to_s.first(64)
        result = pred.vote!(params[:choice], token)

        if result[:error]
          render json: result, status: :unprocessable_entity
        else
          Rails.cache.write(ip_key,     true, expires_in: 24.hours)
          Rails.cache.write(device_key, true, expires_in: 24.hours)
          render json: result
        end
      rescue => e
        Rails.logger.error("[PredictionsController] #{e.message}")
        render json: { error: "server_error" }, status: :internal_server_error
      end

      private

      def empty_result(match_id)
        { match_external_id: match_id, home_votes: 0, draw_votes: 0, away_votes: 0, total: 0, home_pct: 0, draw_pct: 0, away_pct: 0 }
      end
    end
  end
end
