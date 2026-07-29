module Api
  module V1
    class CompetitionsController < BaseController
      include ApiMatchNormalizer

      def index
        render json: FeaturedCompetitions.for_api
      end

      def show
        FeaturedCompetitions.sync_missing!
        competition = Competition.find_by!(code: competition_code_param)
        render json: competition.as_json(
          only: %i[id name code logo country competition_type external_id]
        )
      end
    end
  end
end
