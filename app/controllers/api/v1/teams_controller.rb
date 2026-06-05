module Api
  module V1
    class TeamsController < BaseController
      def index
        teams = Team.order(:group, :name)
        teams = teams.where.not(group: [nil, ""]) if params[:competition] == "WC" || params[:wc] == "1"
        render json: teams
      end

      def show
        team = Team.find(params[:id])
        matches = team.matches.includes(:home_team, :away_team).order(:kickoff_at)
        render json: team.as_json.merge(matches: matches)
      end
    end
  end
end
