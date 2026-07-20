module Api
  module V1
    class CompetitionsController < BaseController
      include ApiMatchNormalizer

      def index
        render json: FeaturedCompetitions.for_api
      end

      def show
        FeaturedCompetitions.sync_missing!
        competition = Competition.includes(matches: [ :home_team, :away_team ])
                                 .find_by!(code: competition_code_param)
        render json: competition.as_json(
          only: %i[id name code logo country competition_type],
          include: {
            matches: {
              only: %i[id external_id status kickoff_at home_score away_score round group_stage],
              include: {
                home_team: { only: %i[id name code flag_url] },
                away_team: { only: %i[id name code flag_url] }
              }
            }
          }
        )
      end
    end
  end
end
