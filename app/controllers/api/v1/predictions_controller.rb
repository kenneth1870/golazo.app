module Api
  module V1
    class PredictionsController < BaseController
      def show
        pred = Prediction.find_or_initialize_by(match_external_id: params[:match_id])
        render json: pred.new_record? ? empty_result(params[:match_id]) : pred.as_json_result
      end

      def vote
        # Rate-limit: one vote per IP per match per 24 hours
        ip_key = "vote_ip_#{request.remote_ip}_#{params[:match_id]}"
        if Rails.cache.read(ip_key)
          return render json: { error: "already_voted" }, status: :unprocessable_entity
        end

        pred   = Prediction.find_or_create_by!(match_external_id: params[:match_id])
        token  = params[:token].to_s.first(64)
        result = pred.vote!(params[:choice], token)

        if result[:error]
          render json: result, status: :unprocessable_entity
        else
          Rails.cache.write(ip_key, true, expires_in: 24.hours)
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
