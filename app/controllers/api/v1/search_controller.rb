module Api
  module V1
    class SearchController < BaseController
      def index
        q = params[:q].to_s.strip
        return render json: [] if q.length < 2

        needle  = q.downcase
        results = []

        unless AppFocus.wc_paused?
          results.concat(search_db_teams(needle))
          results.concat(search_db_matches(needle))
        end

        if AppFocus.clubs_primary?
          live = search_live_matches(needle)
          results.concat(live)
          results.concat(search_club_teams(needle, results))
          results.concat(search_players(needle))
        end

        render json: dedupe_results(results).first(12)
      rescue => e
        Rails.logger.error("[SearchController] #{e.message}")
        render json: []
      end

      private

      def dedupe_results(results)
        seen = {}
        results.filter do |r|
          key = [ r[:type], r[:id].to_s, r[:name].to_s ].join("|")
          next false if seen[key]

          seen[key] = true
          true
        end
      end

      def search_db_teams(needle)
        Team
          .where("name ILIKE :q OR code ILIKE :q", q: "%#{needle}%")
          .limit(6)
          .map { |t| serialize_db_team(t) }
      end

      def search_db_matches(needle)
        now = Time.current
        Match
          .includes(:home_team, :away_team)
          .joins(:home_team, :away_team)
          .where(
            "teams.name ILIKE :q OR away_teams_matches.name ILIKE :q",
            q: "%#{needle}%"
          )
          .order(
            Arel.sql(
              Match.sanitize_sql_array([
                "CASE WHEN status IN ('scheduled','live') AND kickoff_at >= ? THEN 0 ELSE 1 END, ABS(EXTRACT(EPOCH FROM (kickoff_at - ?::timestamptz))) ASC",
                now, now
              ])
            )
          )
          .limit(5)
          .map { |m| serialize_db_match(m) }
      end

      def search_live_matches(needle)
        client = LiveScoresClient.new
        dates  = (Date.today - 1)..(Date.today + 14)
        raw    = dates.flat_map { |d| client.matches_for_date(d) }
                      .select { |m| AppFocus.important_match?(m) }
                      .uniq { |m| m[:external_id] }

        raw.select { |m| match_names(m).any? { |n| n.include?(needle) } }
           .sort_by { |m| [ m[:status] == "live" ? 0 : 1, m[:kickoff_at].to_s ] }
           .first(6)
           .map { |m| serialize_live_match(m) }
      end

      def search_club_teams(needle, existing)
        known = existing.filter_map { |r| r[:name].to_s.downcase if r[:type] == "team" }.to_set
        teams = []
        client = LiveScoresClient.new

        AppFocus::FEATURED_CLUB_CODES.each do |code|
          league_id = AppFocus.league_id_for(code)
          next unless league_id

          season = client.current_season_for_league(league_id, code)
          rows   = Rails.cache.fetch("search_teams_v1_#{code}_#{season}", expires_in: 30.minutes) do
            client.league_standings(league_id, season) || []
          end

          rows.each do |r|
            raw_name = r.dig("team", "name")
            name     = TeamDisplayNames.display_name(raw_name)
            next unless name.downcase.include?(needle)
            next if known.include?(name.downcase)

            teams << {
              type:        "team",
              id:          "club-#{name.parameterize}",
              name:        name,
              slug:        TeamDisplayNames.slug_for(name),
              code:        name.slice(0, 3).upcase,
              flag_url:    TeamDisplayNames.flag_url(raw_name, r.dig("team", "logo")),
              group:       nil,
              league_code: code
            }
          end
        end

        teams.first(6)
      end

      def search_players(needle)
        client = LiveScoresClient.new
        client.search_players(needle).first(4).filter_map do |p|
          id = p["id"] || p.dig("player", "id")
          name = p["name"] || p.dig("player", "name")
          next if id.blank? || name.blank?

          {
            type:  "player",
            id:    id,
            name:  name,
            team:  p.dig("team", "name"),
            photo: p["photo"] || p.dig("player", "photo")
          }
        end
      rescue => e
        Rails.logger.error("[SearchController#search_players] #{e.message}")
        []
      end

      def match_names(match)
        home = match.dig(:home, :name).to_s
        away = match.dig(:away, :name).to_s
        [ home, away, TeamDisplayNames.display_name(home), TeamDisplayNames.display_name(away) ].map(&:downcase)
      end

      def serialize_db_team(team)
        {
          type:     "team",
          id:       team.id,
          name:     TeamDisplayNames.display_name(team.name),
          code:     team.code,
          flag_url: TeamDisplayNames.flag_url(team.name, team.flag_url),
          group:    team.group
        }
      end

      def serialize_db_match(match)
        home = match.home_team
        away = match.away_team
        {
          type:        "match",
          id:          match.id,
          external_id: match.external_id,
          home:        TeamDisplayNames.display_name(home&.name),
          away:        TeamDisplayNames.display_name(away&.name),
          home_flag:   TeamDisplayNames.flag_url(home&.name, home&.flag_url),
          away_flag:   TeamDisplayNames.flag_url(away&.name, away&.flag_url),
          home_score:  match.home_score,
          away_score:  match.away_score,
          status:      match.status,
          kickoff_at:  match.kickoff_at
        }
      end

      def serialize_live_match(match)
        home_raw = match.dig(:home, :name)
        away_raw = match.dig(:away, :name)
        {
          type:        "match",
          id:          match[:external_id],
          external_id: match[:external_id],
          home:        TeamDisplayNames.display_name(home_raw),
          away:        TeamDisplayNames.display_name(away_raw),
          home_flag:   TeamDisplayNames.flag_url(home_raw, match.dig(:home, :logo)),
          away_flag:   TeamDisplayNames.flag_url(away_raw, match.dig(:away, :logo)),
          home_score:  match.dig(:home, :score),
          away_score:  match.dig(:away, :score),
          status:      match[:status],
          kickoff_at:  match[:kickoff_at]
        }
      end
    end
  end
end
