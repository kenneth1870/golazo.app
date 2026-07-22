module Api
  module V1
    class CompetitionFixturesController < BaseController
      include ApiMatchNormalizer

      TAB_WINDOWS = {
        "results"  => { past: 90, future: 0 },
        "fixtures" => { past: 0, future: 60 },
        "today"    => { past: 7, future: 7 }
      }.freeze

      def index
        code = competition_code_param
        league_id = AppFocus.league_id_for(code)
        return render(json: []) unless league_id

        tz    = sanitize_tz(params[:tz])
        today = params[:date].present? ? Date.parse(params[:date]) : TZInfo::Timezone.get(tz).now.to_date
        tab   = params[:tab].to_s.presence || "today"
        window = TAB_WINDOWS[tab] || TAB_WINDOWS["today"]
        from = today - window[:past]
        to   = today + window[:future]

        client = LiveScoresClient.new
        season = client.current_season_for_league(league_id, code)
        matches = normalize_league_matches(client, league_id, from, to, code, tz, season)

        # Off-season / new season: previous season may still hold recent results or late fixtures.
        if matches.empty? && tab != "today"
          matches = normalize_league_matches(client, league_id, from, to, code, tz, season.to_i - 1)
        end

        render json: filter_for_tab(matches, tab, today: today, tz: tz)
      rescue ArgumentError
        render json: []
      end

      private

      def normalize_league_matches(client, league_id, from, to, code, tz, season)
        raw = client.matches_for_league(
          league_id, from: from, to: to, code: code, timezone: tz, season: season
        ).reject { |m| m[:league_name].to_s.match?(/friendlies?\b/i) }

        seen = {}
        normalized = raw.filter_map do |m|
          key = m[:external_id].to_s
          next if key.blank? || seen[key]
          seen[key] = true
          normalize_api_match(m)
        end
        dedupe_fixture_matches(normalized)
      end

      def filter_for_tab(matches, tab, today: nil, tz: "UTC")
        case tab
        when "results"
          matches.select { |m| m[:status] == "finished" }
                 .sort_by { |m| m[:kickoff_at].to_s }
                 .reverse!
        when "fixtures"
          matches.select { |m| m[:status] == "scheduled" }
                 .sort_by { |m| m[:kickoff_at].to_s }
        when "today"
          zone = TZInfo::Timezone.get(tz)
          target = today || zone.now.to_date
          matches.select do |m|
            m[:status] == "live" || match_local_date?(m[:kickoff_at], target, zone)
          end.sort_by { |m| m[:kickoff_at].to_s }
        else
          matches.sort_by { |m| m[:kickoff_at].to_s }
        end
      end
    end
  end
end
