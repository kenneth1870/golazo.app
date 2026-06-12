module Api
  module V1
    class TodayController < BaseController
      def index
        date = parse_date(params[:date]) || Date.today
        tz   = sanitize_tz(params[:tz])
        all  = merge_matches(date, tz).sort_by { |m| m[:kickoff_at].to_s }

        # When today has no matches, append next upcoming WC fixtures so the
        # frontend can show a teaser without a second round-trip.
        if all.empty? && date == Date.today
          upcoming = fetch_upcoming_wc(6).map { |m| normalize_db(m).merge(upcoming_preview: true) }
          all = upcoming
        end

        render json: all
      end

      private

      def parse_date(val)
        return nil if val.blank?
        Date.parse(val)
      rescue ArgumentError
        nil
      end

      # Common country name aliases across data providers (football-data.org vs API-Football).
      TEAM_ALIASES = {
        "czech republic"        => "czechia",
        "korea republic"        => "south korea",
        "republic of korea"     => "south korea",
        "dpr korea"             => "north korea",
        "republic of ireland"   => "ireland",
        "ivory coast"           => "côte d'ivoire",
        "cape verde"            => "cape verde islands",
        "usa"                   => "united states",
        "trinidad & tobago"     => "trinidad and tobago",
        "bosnia & herz."        => "bosnia & herzegovina",
        "bosnia and herzegovina" => "bosnia & herzegovina",
        "north macedonia"       => "macedonia",
        "fyr macedonia"         => "macedonia",
        # Curaçao: API-Football uses accented ç; DB stores plain Curacao
        "curaçao"               => "curacao",
        # Ivory Coast reversed: DB may store either direction
        "côte d'ivoire"         => "ivory coast",
      }.freeze

      def normalize_team_name(name)
        n = name.to_s.downcase.strip
        TEAM_ALIASES[n] || n
      end

      # Merge live-API matches with DB matches for the date.
      # API match wins on duplicate (same home+away team pair) since it has live scores.
      def merge_matches(date, tz = "UTC")
        api_matches = fetch_api_matches(date)
        db_matches  = fetch_db_matches(date, tz)

        # Index API matches by normalised home+away pair for dedup
        api_keys = api_matches.each_with_object(Set.new) do |m, s|
          h = normalize_team_name(m.dig(:home_team, :name))
          a = normalize_team_name(m.dig(:away_team, :name))
          s << "#{h}|#{a}"
        end

        # Include DB matches that don't already appear in the API response
        db_only = db_matches.reject do |m|
          h = normalize_team_name(m.dig(:home_team, :name))
          a = normalize_team_name(m.dig(:away_team, :name))
          api_keys.include?("#{h}|#{a}")
        end

        api_matches + db_only
      end

      def fetch_api_matches(date)
        Rails.cache.fetch("today_api_#{date.iso8601}", expires_in: 30.seconds) do
          client  = LiveScoresClient.new
          matches = client.matches_for_date(date)

          # Also pull the next UTC day so that evening matches in western timezones
          # (Americas, UTC-8 to UTC-3) are included. A match at 01:00 UTC on June 10
          # is 17:00–22:00 local on June 9 — the user's "today". Only include
          # tomorrow-UTC matches that start before 07:00 UTC (≤ midnight UTC-7).
          next_day = client.matches_for_date(date + 1).select do |m|
            t = Time.parse(m[:kickoff_at].to_s) rescue nil
            t && t.utc.hour < 7
          end

          seen = Set.new(matches.map { |m| m[:external_id] })
          combined = matches + next_day.reject { |m| seen.include?(m[:external_id]) }
          combined.map { |m| normalize_api(m) }
        end
      rescue => e
        Rails.logger.error("[TodayController] API matches failed: #{e.message}")
        []
      end

      # Only pull WC matches from DB — club/Copa fixtures are real-API only.
      # Seeded club league and Copa América rows have wrong/fake dates and
      # must not contaminate the live Today feed.
      def fetch_upcoming_wc(limit = 6)
        Match
          .joins(:competition)
          .where(competitions: { code: "WC" })
          .where("kickoff_at > ?", Time.current)
          .where(status: "scheduled")
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
          .limit(limit)
      rescue => e
        Rails.logger.error("[TodayController] Upcoming WC failed: #{e.message}")
        []
      end

      def fetch_db_matches(date, tz = "UTC")
        Match
          .joins(:competition)
          .where(competitions: { code: "WC" })
          .where(kickoff_at: local_day_range(date, tz))
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
          .map { |m| normalize_db(m) }
      rescue => e
        Rails.logger.error("[TodayController] DB matches failed: #{e.message}")
        []
      end

      # Canonical names for key competitions so API and DB matches render
      # the same section header regardless of what the API returns.
      LEAGUE_CANONICAL_NAMES = {
        1 => "FIFA World Cup 2026",
      }.freeze

      def normalize_api(m)
        league_id = m[:league_id].to_i
        code      = league_code(league_id)
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
            id:      code,
            name:    LEAGUE_CANONICAL_NAMES[league_id] || m[:league_name],
            code:    code,
            logo:    m[:league_logo],
            country: m[:league_country]
          },
          home_red_cards: m.dig(:home, :red_cards).to_i,
          away_red_cards: m.dig(:away, :red_cards).to_i,
          home_team: { name: m.dig(:home, :name), flag_url: m.dig(:home, :logo) },
          away_team: { name: m.dig(:away, :name), flag_url: m.dig(:away, :logo) }
        }
      end

      # Map API-Football league IDs to the codes used in our DB.
      LEAGUE_ID_TO_CODE = {
        1   => "WC",
        2   => "CL",
        39  => "PL",
        78  => "BL1",
        135 => "SA",
        140 => "LAL",
        61  => "L1",
      }.freeze

      def league_code(league_id)
        LEAGUE_ID_TO_CODE[league_id.to_i] || league_id.to_s
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
            country: m.competition.country
          } : nil,
          home_team: { name: m.home_team&.name, flag_url: m.home_team&.flag_url },
          away_team: { name: m.away_team&.name, flag_url: m.away_team&.flag_url }
        }
      end
    end
  end
end
