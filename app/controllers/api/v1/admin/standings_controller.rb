module Api
  module V1
    module Admin
      class StandingsController < BaseController
        before_action :require_admin!

        def recalculate
          RecalculateStandingsJob.perform_now
          render json: {
            ok: true,
            recalculated_at: Rails.cache.read("standings_last_recalculated_at")
          }
        rescue => e
          render json: { error: e.message }, status: :internal_server_error
        end

        def index
          competition = Competition.find_by!(code: "WC")
          calc        = WorldCupStandings.new(competition)

          groups = calc.groups.transform_values do |ranked|
            ranked.map do |s|
              {
                team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
                group:         s.team.group,
                played:        s.played,
                won:           s.won,
                drawn:         s.drawn,
                lost:          s.lost,
                goals_for:     s.goals_for,
                goals_against: s.goals_against,
                goal_diff:     s.goal_difference,
                points:        s.points,
              }
            end
          end

          wc = competition
          status_counts = Match.where(competition: wc).group(:status).count
          live_count    = Match.where(competition: wc, status: "live").count
          anomalies     = Match.where(competition: wc, status: "finished")
                               .where(home_score: nil).or(Match.where(competition: wc, status: "finished", away_score: nil))
                               .count

          render json: {
            groups:              groups,
            last_recalculated_at: Rails.cache.read("standings_last_recalculated_at"),
            match_status_counts: status_counts,
            live_match_count:    live_count,
            anomaly_count:       anomalies,
          }
        rescue ActiveRecord::RecordNotFound
          render json: {}, status: :not_found
        end
      end
    end
  end
end
