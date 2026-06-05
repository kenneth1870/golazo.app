module Api
  module V1
    class TodayController < BaseController
      def index
        date = parse_date(params[:date]) || Date.today
        all  = merge_matches(date).sort_by { |m| m[:kickoff_at].to_s }
        render json: all
      end

      private

      def parse_date(val)
        return nil if val.blank?
        Date.parse(val)
      rescue ArgumentError
        nil
      end

      # Merge live-API matches with DB matches for the date.
      # API match wins on duplicate (same home+away team pair) since it has live scores.
      def merge_matches(date)
        api_matches = fetch_api_matches(date)
        db_matches  = fetch_db_matches(date)

        # Index API matches by normalised home+away pair for dedup
        api_keys = api_matches.each_with_object(Set.new) do |m, s|
          h = m.dig(:home_team, :name).to_s.downcase.strip
          a = m.dig(:away_team, :name).to_s.downcase.strip
          s << "#{h}|#{a}"
        end

        # Include DB matches that don't already appear in the API response
        db_only = db_matches.reject do |m|
          h = m.dig(:home_team, :name).to_s.downcase.strip
          a = m.dig(:away_team, :name).to_s.downcase.strip
          api_keys.include?("#{h}|#{a}")
        end

        api_matches + db_only
      end

      def fetch_api_matches(date)
        LiveScoresClient.new.matches_for_date(date).map { |m| normalize_api(m) }
      rescue => e
        Rails.logger.error("[TodayController] API matches failed: #{e.message}")
        []
      end

      # Only pull WC matches from DB — club/Copa fixtures are real-API only.
      # Seeded club league and Copa América rows have wrong/fake dates and
      # must not contaminate the live Today feed.
      def fetch_db_matches(date)
        Match
          .joins(:competition)
          .where(competitions: { code: "WC" })
          .where(kickoff_at: date.all_day)
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
          .map { |m| normalize_db(m) }
      rescue => e
        Rails.logger.error("[TodayController] DB matches failed: #{e.message}")
        []
      end

      def normalize_api(m)
        {
          id:          "ext_#{m[:external_id]}",
          external_id: m[:external_id],
          status:      m[:status],
          minute:      m[:minute],
          kickoff_at:  m[:kickoff_at],
          home_score:  m.dig(:home, :score),
          away_score:  m.dig(:away, :score),
          round:       nil,
          group_stage: nil,
          competition: {
            id:      m[:league_id],
            name:    m[:league_name],
            code:    m[:league_id].to_s,
            logo:    m[:league_logo],
            country: m[:league_country],
          },
          home_team: { name: m.dig(:home, :name), flag_url: m.dig(:home, :logo) },
          away_team: { name: m.dig(:away, :name), flag_url: m.dig(:away, :logo) },
        }
      end

      def normalize_db(m)
        {
          id:          "db_#{m.id}",
          external_id: m.external_id,
          status:      m.status,
          minute:      nil,
          kickoff_at:  m.kickoff_at&.iso8601,
          home_score:  m.home_score,
          away_score:  m.away_score,
          round:       m.round,
          group_stage: m.group_stage,
          competition: m.competition ? {
            id:      m.competition.id,
            name:    m.competition.name,
            code:    m.competition.code,
            logo:    m.competition.logo,
            country: m.competition.country,
          } : nil,
          home_team: { name: m.home_team&.name, flag_url: m.home_team&.flag_url },
          away_team: { name: m.away_team&.name, flag_url: m.away_team&.flag_url },
        }
      end
    end
  end
end
