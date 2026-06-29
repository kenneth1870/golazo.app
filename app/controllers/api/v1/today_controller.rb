module Api
  module V1
    class TodayController < BaseController
      def index
        tz   = sanitize_tz(params[:tz])
        # When no explicit date is given (homepage), use the caller's local date,
        # not the server's UTC date. The server runs in UTC; a user in CDT at
        # 22:00 local is on June 13 while the server may already be June 14 UTC,
        # which would cause June 13 matches (Qatar, Brazil) to be excluded.
        date = parse_date(params[:date]) || TZInfo::Timezone.get(tz).now.to_date
        all  = merge_matches(date, tz).sort_by { |m| m[:kickoff_at].to_s }

        # Safety net: always inject finished/live WC matches from DB for the
        # requested date. Prevents stale API caches (24h TTL for past dates)
        # from hiding completed matches. For today, also catches matches that
        # kicked off after a cache was populated.
        wc_db     = fetch_wc_from_db_for_date(date, tz)

        # Overlay DB scores onto API matches for live/finished WC matches.
        # The API date endpoint can lag several minutes behind the live endpoint;
        # the DB is updated in real-time by sync_match_from_live. This prevents
        # the 30s safety-net poll from reverting a just-scored goal back to 0-0.
        # Match by external_id first; fall back to home|away team name because
        # some DB records carry old football-data.org IDs that differ from API-Football.
        db_live = wc_db.select { |m| %w[live finished].include?(m[:status].to_s) }
        db_by_ext   = db_live.each_with_object({}) { |m, h| h[m[:external_id]&.to_s] = m if m[:external_id] }
        db_by_teams = db_live.each_with_object({}) do |m, h|
          key = "#{normalize_team_name(m.dig(:home_team, :name))}|#{normalize_team_name(m.dig(:away_team, :name))}"
          h[key] = m
        end
        all = all.map do |m|
          db_m = db_by_ext[m[:external_id]&.to_s]
          unless db_m
            key  = "#{normalize_team_name(m.dig(:home_team, :name))}|#{normalize_team_name(m.dig(:away_team, :name))}"
            db_m = db_by_teams[key]
          end
          next m unless db_m
          m.merge(home_score: db_m[:home_score], away_score: db_m[:away_score],
                  status: db_m[:status])
        end

        existing  = all.filter_map { |m| m[:external_id]&.to_s }.to_set
        home_away = all.map { |m|
          "#{normalize_team_name(m.dig(:home_team, :name))}|#{normalize_team_name(m.dig(:away_team, :name))}"
        }.to_set
        # Only inject DB matches that are live or scheduled — finished matches not in the
        # API response are from a different date whose kickoff bled into today's range.
        to_add    = wc_db.reject do |m|
          m[:status].to_s == "finished" ||
            existing.include?(m[:external_id]&.to_s) ||
            home_away.include?("#{normalize_team_name(m.dig(:home_team, :name))}|#{normalize_team_name(m.dig(:away_team, :name))}")
        end
        all = (all + to_add).sort_by { |m| m[:kickoff_at].to_s } unless to_add.empty?

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
      # Maps any API name variant → the canonical DB team name (lowercase).
      # Keep in sync with WorldCupSync::TEAM_ALIASES.
      TEAM_ALIASES = {
        # South Korea
        "korea republic"               => "south korea",
        "republic of korea"            => "south korea",
        "dpr korea"                    => "north korea",
        # Ivory Coast — API uses French name, DB stores English
        "côte d'ivoire"                => "ivory coast",
        "cote d'ivoire"                => "ivory coast",
        "cote divoire"                 => "ivory coast",
        # DR Congo — API-Football uses "Congo DR"; DB stores "DR Congo"
        "congo dr"                     => "dr congo",
        "rd congo"                     => "dr congo",
        "democratic republic of congo" => "dr congo",
        "dr. congo"                    => "dr congo",
        # United States
        "usa"                          => "united states",
        "united states of america"     => "united states",
        # Bosnia — DB stores abbreviation
        "bosnia and herzegovina"       => "bosnia & herz.",
        "bosnia & herzegovina"         => "bosnia & herz.",
        "bosnia-herzegovina"           => "bosnia & herz.",
        # Czechia
        "czech republic"               => "czechia",
        # Cape Verde — DB stores full name
        "cabo verde"                   => "cape verde",
        "cape verde islands"           => "cape verde",
        # Curaçao — API uses accented ç; DB stores plain ascii
        "curaçao"                      => "curacao",
        # Turkey
        "türkiye"                      => "turkey",
        "turkiye"                      => "turkey",
        # Iran
        "ir iran"                      => "iran",
        "islamic republic of iran"     => "iran",
        # Saudi Arabia
        "ksa"                          => "saudi arabia",
        # Algeria
        "algérie"                      => "algeria",
        # Legacy / other providers
        "republic of ireland"          => "ireland",
        "trinidad & tobago"            => "trinidad and tobago",
        "north macedonia"              => "macedonia",
        "fyr macedonia"                => "macedonia"
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
        Rails.cache.fetch("today_api_#{date.iso8601}", expires_in: 90.seconds, race_condition_ttl: 15.seconds) do
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
          combined.select { |m| LEAGUE_ID_TO_CODE[m[:league_id].to_i] == "WC" }
                  .map { |m| normalize_api(m) }
        end
      rescue => e
        Rails.logger.error("[TodayController] API matches failed: #{e.message}")
        []
      end

      # Returns WC matches from the DB for the given local date as a safety net
      # against stale API caches.
      #
      # Includes live/finished matches AND scheduled matches whose kickoff is
      # already in the past (sync lag — the match has started/finished but the
      # background job hasn't written the final status yet). Upcoming scheduled
      # matches are excluded so they don't shadow the live API version.
      def fetch_wc_from_db_for_date(date, tz = "UTC")
        base = Match
          .joins(:competition)
          .where(competitions: { code: "WC" })
          .includes(:home_team, :away_team, :competition)

        date_scope = ->(s) { s.where(kickoff_at: local_day_range(date, tz)) }

        authoritative = date_scope.call(base.where(status: %w[live finished]))
        # Only include overdue scheduled matches that have both teams known — otherwise
        # knockout placeholders with no teams appear as blank "vs" rows.
        overdue       = date_scope.call(
          base.where(status: "scheduled")
              .where("kickoff_at < ?", Time.current)
              .where("home_team_id IS NOT NULL AND away_team_id IS NOT NULL")
        )

        (authoritative.to_a + overdue.to_a).map { |m| normalize_db(m) }.uniq { |m| m[:id] }
      rescue => e
        Rails.logger.error("[TodayController] fetch_wc_from_db_for_date failed: #{e.message}")
        []
      end

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
          # Hide scheduled knockout placeholders whose teams aren't determined yet —
          # they show as blank "vs" rows. Live/finished matches always pass through.
          .where("status != 'scheduled' OR (home_team_id IS NOT NULL AND away_team_id IS NOT NULL)")
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
        1 => "FIFA World Cup 2026"
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
        61  => "L1"
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
          home_team:  { name: m.home_team&.name, flag_url: m.home_team&.flag_url },
          away_team:  { name: m.away_team&.name, flag_url: m.away_team&.flag_url },
          home_slot:  m.home_slot,
          away_slot:  m.away_slot,
          bracket_pos: m.bracket_pos
        }
      end
    end
  end
end
