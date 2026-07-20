module Api
  module V1
    class ConfigController < BaseController
      def show
        render json: {
          focus:             AppFocus::FOCUS,
          wc_paused:         AppFocus.wc_paused?,
          clubs_primary:     AppFocus.clubs_primary?,
          push_enabled:      AppFocus.push_enabled?,
          notifications_paused: AppFocus.notifications_paused?,
          featured_clubs:    AppFocus::FEATURED_CLUB_CODES,
          featured_leagues:  AppFocus::FEATURED_CLUB_CODES.map { |code|
            { code: code, league_id: AppFocus.league_id_for(code) }
          }
        }
      end
    end
  end
end
