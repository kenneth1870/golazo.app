module Api
  module V1
    class ScorePredictionsController < BaseController
      # GET /api/v1/score_predictions/:match_id?device_id=xxx
      def show
        device_id = params[:device_id].to_s.first(64)
        sp = ScorePrediction.find_by(match_external_id: params[:match_id], device_id: device_id)
        if sp
          render json: sp.slice(:home_guess, :away_guess, :points_earned, :display_name)
        else
          render json: { none: true }
        end
      end

      # POST /api/v1/score_predictions/:match_id
      # Body: { device_id, home_guess, away_guess, display_name, home_team_name, away_team_name }
      def create
        device_id = params[:device_id].to_s.first(64)
        return render json: { error: "device_id required" }, status: :unprocessable_entity if device_id.blank?

        sp = ScorePrediction.find_or_initialize_by(
          match_external_id: params[:match_id],
          device_id: device_id
        )

        # Don't allow changing prediction on finished or already-graded matches
        if sp.persisted? && sp.points_earned.present?
          return render json: { error: "match_already_graded" }, status: :unprocessable_entity
        end

        # Block predictions once the match has kicked off (live or finished in DB)
        locked_match = Match.find_by(external_id: params[:match_id])
        if locked_match && %w[live finished].include?(locked_match.status)
          return render json: { error: "match_already_started" }, status: :unprocessable_entity
        end

        sp.assign_attributes(
          home_guess:     params[:home_guess].to_i,
          away_guess:     params[:away_guess].to_i,
          display_name:   params[:display_name].to_s.first(32).presence,
          home_team_name: params[:home_team_name].to_s.first(64),
          away_team_name: params[:away_team_name].to_s.first(64),
        )

        if sp.save
          render json: sp.slice(:home_guess, :away_guess, :points_earned, :display_name), status: :created
        else
          render json: { error: sp.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/score_predictions/leaderboard
      def leaderboard
        rows = ScorePrediction.leaderboard(limit: 100)
        render json: rows.map { |r|
          {
            display_name:     r.display_name.presence || "Anonymous",
            total_points:     r.total_points.to_i,
            predictions_made: r.predictions_made.to_i
          }
        }
      end

      # GET /api/v1/score_predictions/by_device?device_id=xxx
      # Returns all graded predictions for a device (for comparison page)
      def by_device
        device_id = params[:device_id].to_s.first(64)
        return render json: { error: "device_id required" }, status: :bad_request if device_id.blank?

        preds = ScorePrediction
                  .where(device_id: device_id)
                  .where.not(points_earned: nil) # only graded
                  .order(updated_at: :desc)
                  .limit(50)

        total = preds.sum(:points_earned)
        name  = preds.first&.display_name.presence || "Anonymous"

        render json: {
          device_id:    device_id,
          display_name: name,
          total_points: total,
          predictions:  preds.map { |p|
            {
              match_external_id: p.match_external_id,
              home_team_name:    p.home_team_name,
              away_team_name:    p.away_team_name,
              home_guess:        p.home_guess,
              away_guess:        p.away_guess,
              points_earned:     p.points_earned
            }
          }
        }
      end
    end
  end
end
