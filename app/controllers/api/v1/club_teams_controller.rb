module Api
  module V1
    class ClubTeamsController < BaseController
      include ApiMatchNormalizer

      def show
        code = params[:code].to_s.upcase
        slug = params[:slug].to_s
        league_id = AppFocus.league_id_for(code)
        return render(json: { error: "not_found" }, status: :not_found) unless league_id && slug.present?

        standing = find_standing(code, slug)
        return render(json: { error: "not_found" }, status: :not_found) unless standing

        team_name = standing.dig(:team, :name)
        tz = sanitize_tz(params[:tz])
        today = TZInfo::Timezone.get(tz).now.to_date
        client = LiveScoresClient.new

        raw = client.matches_for_league(league_id, from: today - 30, to: today + 30, code: code, timezone: tz)
                  .reject { |m| AppFocus.excluded_match?(m) }

        seen = {}
        team_matches = raw.filter_map do |m|
          next unless team_in_match?(m, team_name)
          key = m[:external_id].to_s
          next if key.blank? || seen[key]

          seen[key] = true
          normalize_api_match(m)
        end

        upcoming = team_matches.select { |m| m[:status] == "scheduled" }.sort_by { |m| m[:kickoff_at].to_s }
        recent   = team_matches.select { |m| m[:status] == "finished" }.sort_by { |m| m[:kickoff_at].to_s }.reverse

        render json: {
          team: standing[:team].merge(slug: slug, league_code: code),
          standing: standing.except(:team),
          competition: competition_json(code),
          upcoming: upcoming.first(8),
          recent: recent.first(8)
        }
      rescue => e
        Rails.logger.error("[ClubTeamsController] #{e.message}")
        render json: { error: "error" }, status: :internal_server_error
      end

      private

      def find_standing(code, slug)
        flat = flatten_standings(cached_standings(code))
        flat.find { |s| TeamDisplayNames.matches_slug?(s.dig(:team, :name), slug) }
      end

      def cached_standings(code)
        Rails.cache.fetch("standings_#{code}", expires_in: 30.minutes, race_condition_ttl: 10.seconds) do
          fetch_standings_from_api(code)
        end
      end

      def fetch_standings_from_api(code)
        league_id = AppFocus.league_id_for(code)
        return {} unless league_id

        client = LiveScoresClient.new
        season = client.current_season_for_league(league_id, code)
        rows   = client.league_standings(league_id, season)
        return {} if rows.blank?

        flat = rows.map do |r|
          team = r["team"] || {}
          display_name = TeamDisplayNames.display_name(team["name"])
          {
            rank:          r["rank"],
            group_name:    (r["group"] || "Overall").to_s.sub(/\AGroup\s+/i, ""),
            team:          {
              name:     display_name,
              code:     display_name&.slice(0, 3)&.upcase,
              flag_url: TeamDisplayNames.flag_url(team["name"], team["logo"])
            },
            played:        r["all"]["played"],
            won:           r["all"]["win"],
            drawn:         r["all"]["draw"],
            lost:          r["all"]["lose"],
            goals_for:     r["all"]["goals"]["for"],
            goals_against: r["all"]["goals"]["against"],
            goal_diff:     r["goalsDiff"],
            points:        r["points"]
          }
        end
        flat.group_by { |s| s[:group_name] }
      end

      def flatten_standings(data)
        return data if data.is_a?(Array)
        return data.values.flatten if data.is_a?(Hash)

        []
      end

      def team_in_match?(match, display_name)
        home = TeamDisplayNames.display_name(match.dig(:home, :name))
        away = TeamDisplayNames.display_name(match.dig(:away, :name))
        home == display_name || away == display_name
      end

      def competition_json(code)
        comp = Competition.find_by(code: code)
        if comp
          return comp.as_json(only: %i[id name code logo country competition_type])
        end

        league_id = AppFocus.league_id_for(code)
        {
          id:   code,
          name: LEAGUE_CANONICAL_NAMES[league_id] || code,
          code: code,
          logo: nil,
          country: nil,
          competition_type: "league"
        }
      end
    end
  end
end
