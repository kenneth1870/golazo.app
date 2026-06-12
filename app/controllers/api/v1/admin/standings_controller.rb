module Api
  module V1
    module Admin
      class StandingsController < BaseController
        before_action :require_admin!

        def recalculate
          WorldCupSync.new(competition_code: "WC").recalculate_standings_from_results
          Rails.cache.delete("standings_WC")
          WorldCupKnockout.rebuild!
          render json: { ok: true }
        rescue => e
          render json: { error: e.message }, status: :internal_server_error
        end

        def index
          groups = Team.where.not(group: [nil, ""]).order(:group, :name).group_by(&:group)

          render json: groups.transform_values do |teams|
            teams.map do |t|
              finished = Match.where("(home_team_id = ? OR away_team_id = ?) AND status = 'finished'", t.id, t.id)
              played = finished.count
              won    = finished.count { |m| (m.home_team_id == t.id && m.home_score.to_i > m.away_score.to_i) ||
                                            (m.away_team_id == t.id && m.away_score.to_i > m.home_score.to_i) }
              drawn  = finished.count { |m| m.home_score.to_i == m.away_score.to_i }
              lost   = played - won - drawn
              gf     = finished.sum { |m| m.home_team_id == t.id ? m.home_score.to_i : m.away_score.to_i }
              ga     = finished.sum { |m| m.home_team_id == t.id ? m.away_score.to_i : m.home_score.to_i }

              {
                team:          { id: t.id, name: t.name, code: t.code, flag_url: t.flag_url },
                group:         t.group,
                played:        played,
                won:           won,
                drawn:         drawn,
                lost:          lost,
                goals_for:     gf,
                goals_against: ga,
                goal_diff:     gf - ga,
                points:        won * 3 + drawn,
              }
            end.sort_by { |r| [-r[:points], -r[:goal_diff], -r[:goals_for]] }
          end
        end
      end
    end
  end
end
