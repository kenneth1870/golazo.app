module Api
  module V1
    class TodayController < BaseController
      include ApiMatchNormalizer
      def index
        tz   = sanitize_tz(params[:tz])
        # When no explicit date is given (homepage), use the caller's local date,
        # not the server's UTC date. The server runs in UTC; a user in CDT at
        # 22:00 local is on June 13 while the server may already be June 14 UTC,
        # which would cause June 13 matches (Qatar, Brazil) to be excluded.
        date = parse_date(params[:date]) || TZInfo::Timezone.get(tz).now.to_date
        all  = merge_matches(date, tz).sort_by { |m| m[:kickoff_at].to_s }
        unless AppFocus.wc_paused?
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
                  home_pen_score: db_m[:home_pen_score], away_pen_score: db_m[:away_pen_score],
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
        end

        if all.empty? && date == TZInfo::Timezone.get(tz).now.to_date
          all = if AppFocus.wc_paused?
            fetch_upcoming_clubs(8, tz)
          else
            fetch_upcoming_wc(6).map { |m| normalize_db(m).merge(upcoming_preview: true) }
          end
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
        api_matches = fetch_api_matches(date, tz)
        return api_matches if AppFocus.wc_paused?

        db_matches  = fetch_db_matches(date, tz)

        # Index API matches by normalised home+away pair for dedup.
        # Also track individual team names so phantom knockout slots with wrong
        # opponents (e.g. "France vs DR Congo" when the real match is "France vs Sweden")
        # don't slip through just because the exact pair doesn't match.
        api_keys  = Set.new
        api_teams = Set.new
        api_matches.each do |m|
          h = normalize_team_name(m.dig(:home_team, :name))
          a = normalize_team_name(m.dig(:away_team, :name))
          api_keys  << "#{h}|#{a}"
          api_teams << h
          api_teams << a
        end

        # Include DB matches that don't already appear in the API response.
        # Knockout placeholder matches (group_stage nil) are additionally excluded
        # when either of their teams already appears in an API match — these are
        # stale bracket slots that got stamped with wrong opponents.
        db_only = db_matches.reject do |m|
          h = normalize_team_name(m.dig(:home_team, :name))
          a = normalize_team_name(m.dig(:away_team, :name))
          next true if api_keys.include?("#{h}|#{a}")
          knockout = m[:group_stage].nil?
          knockout && (api_teams.include?(h) || api_teams.include?(a))
        end

        api_matches + db_only
      end

      def fetch_api_matches(date, tz = "UTC")
        Rails.cache.fetch("today_api_v2_#{date.iso8601}_#{tz}", expires_in: 90.seconds, race_condition_ttl: 15.seconds) do
          client = LiveScoresClient.new

          raw = if AppFocus.wc_paused?
            fetch_club_league_raw_matches(client, date, tz)
          else
            matches = client.matches_for_date(date, timezone: tz)
            next_day = client.matches_for_date(date + 1, timezone: tz).select do |m|
              t = Time.parse(m[:kickoff_at].to_s) rescue nil
              t && t.utc.hour < 7
            end
            seen = Set.new(matches.map { |m| m[:external_id] })
            matches + next_day.reject { |m| seen.include?(m[:external_id]) }
          end

          normalized = filter_matches_for_focus(raw).map { |m| normalize_api_match(m) }

          if AppFocus.wc_paused?
            zone = TZInfo::Timezone.get(tz)
            normalized.select { |m| match_local_date?(m[:kickoff_at], date, zone) }
          else
            normalized
          end
        end
      rescue => e
        Rails.logger.error("[TodayController] API matches failed: #{e.message}")
        []
      end

      # Liga MX / Liga Tica jornadas are often stacked on Sunday in the API; adjusted_kickoff
      # shifts them to Thursday. Pull a week-wide window per league, then filter locally.
      def fetch_club_league_raw_matches(client, date, tz)
        seen = {}
        combined = []

        AppFocus::FEATURED_CLUB_CODES.each do |code|
          league_id = AppFocus.league_id_for(code)
          next unless league_id

          season = client.current_season_for_league(league_id, code)
          client.matches_for_league(
            league_id, from: date - 7, to: date + 7, code: code, timezone: tz, season: season
          ).each do |m|
            key = m[:external_id].to_s
            next if key.blank? || seen[key]

            seen[key] = true
            combined << m
          end
        end

        [ date - 1, date, date + 1 ].each do |d|
          client.matches_for_date(d, timezone: tz).each do |m|
            key = m[:external_id].to_s
            next if key.blank? || seen[key]

            seen[key] = true
            combined << m
          end
        end

        combined
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

        authoritative = date_scope.call(base.where(status: %w[live finished])
                                           .where("home_team_id IS NOT NULL AND away_team_id IS NOT NULL"))
        # Only include overdue scheduled matches that have both teams known — otherwise
        # knockout placeholders with no teams appear as blank "vs" rows.
        # Also skip midnight-UTC placeholders (see fetch_db_matches).
        overdue       = date_scope.call(
          base.where(status: "scheduled")
              .where("kickoff_at < ?", Time.current)
              .where("home_team_id IS NOT NULL AND away_team_id IS NOT NULL")
              .where("kickoff_at != date_trunc('day', kickoff_at)")
        )

        (authoritative.to_a + overdue.to_a).map { |m| normalize_db(m) }.uniq { |m| m[:id] }
      rescue => e
        Rails.logger.error("[TodayController] fetch_wc_from_db_for_date failed: #{e.message}")
        []
      end

      def fetch_upcoming_clubs(limit = 8, tz = "UTC")
        zone = TZInfo::Timezone.get(tz)
        local_today = zone.now.to_date
        client = LiveScoresClient.new
        raw = fetch_club_league_raw_matches(client, local_today, tz)

        picks = filter_matches_for_focus(raw)
          .select { |m| m[:status] == "scheduled" }
          .map { |m| normalize_api_match(m) }
          .select { |m| local_kickoff_date(m[:kickoff_at], zone)&.> local_today }
          .sort_by { |m| m[:kickoff_at].to_s }
          .first(limit)
          .map { |m| m.merge(upcoming_preview: true) }
      rescue => e
        Rails.logger.error("[TodayController] Upcoming clubs failed: #{e.message}")
        []
      end

      def local_kickoff_date(kickoff_at, zone)
        return nil if kickoff_at.blank?

        zone.utc_to_local(Time.parse(kickoff_at.to_s).utc).to_date
      rescue ArgumentError, TZInfo::InvalidTimezoneIdentifier
        nil
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
          # Only show matches where both teams are confirmed. Knockout placeholder
          # slots with a null team should never appear — the API feed covers live
          # matches, and a stale slot erroneously set to "live" would show as a
          # duplicate alongside the real record.
          .where("home_team_id IS NOT NULL AND away_team_id IS NOT NULL")
          # Exclude scheduled matches with a midnight-UTC placeholder kickoff.
          # Knockout bracket slots are pre-seeded at 00:00:00 UTC before real
          # dates are confirmed; in western timezones that midnight converts to the
          # previous calendar day, causing them to bleed onto today's list.
          # The heal job writes the real time once the API publishes it, after
          # which these matches appear on their correct date automatically.
          .where("status != 'scheduled' OR kickoff_at != date_trunc('day', kickoff_at)")
          .includes(:home_team, :away_team, :competition)
          .order(:kickoff_at)
          .map { |m| normalize_db(m) }
      rescue => e
        Rails.logger.error("[TodayController] DB matches failed: #{e.message}")
        []
      end

      # Canonical names for key competitions so API and DB matches render
      # the same section header regardless of what the API returns.
      def normalize_api(m)
        normalize_api_match(m)
      end

      def normalize_db(m)
        {
          id:           "db_#{m.id}",
          external_id:  m.external_id,
          status:       m.status,
          minute:       nil,
          kickoff_at:   m.kickoff_at&.iso8601,
          home_score:   m.home_score,
          away_score:   m.away_score,
          home_pen_score: m.home_pen_score,
          away_pen_score: m.away_pen_score,
          round:        m.round,
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
