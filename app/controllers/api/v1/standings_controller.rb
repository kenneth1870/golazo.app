module Api
  module V1
    class StandingsController < BaseController
      def best_thirds
        result = Rails.cache.fetch("standings_WC_best_thirds", expires_in: 3.minutes, race_condition_ttl: 10.seconds) do
          wc = Competition.find_by(code: "WC")
          next [] unless wc
          WorldCupStandings.new(wc).third_place_table.each_with_index.map do |s, idx|
            {
              rank:          idx + 1,
              team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url, group: s.team.group },
              played:        s.played,
              won:           s.won,
              drawn:         s.drawn,
              lost:          s.lost,
              goals_for:     s.goals_for,
              goals_against: s.goals_against,
              goal_diff:     s.goal_difference,
              points:        s.points
            }
          end
        end
        render json: result
      end

      def index
        competition_code = params[:competition].presence || (AppFocus.wc_paused? ? "PL" : "WC")
        ttl = competition_code == "WC" ? 3.minutes : 30.minutes

        result = Rails.cache.fetch("standings_#{competition_code}", expires_in: ttl, race_condition_ttl: 10.seconds) do
          if competition_code == "WC"
            wc_standings_from_results
          else
            external_standings(competition_code)
          end
        end

        render json: result
      end

      private

      # WC standings computed directly from our DB match results via WorldCupStandings.
      # Always accurate — no dependency on the external API's Standing table being current.
      def wc_standings_from_results
        wc = Competition.find_by(code: "WC")
        return {} unless wc

        calc = WorldCupStandings.new(wc)

        calc.groups.transform_values do |ranked|
          ranked.each_with_index.map do |s, idx|
            {
              rank:          idx + 1,
              group_name:    s.team.group,
              team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
              played:        s.played,
              won:           s.won,
              drawn:         s.drawn,
              lost:          s.lost,
              goals_for:     s.goals_for,
              goals_against: s.goals_against,
              goal_diff:     s.goal_difference,
              points:        s.points
            }
          end
        end
      end

      # Non-WC competitions: DB standings when synced, otherwise API-Football.
      def external_standings(competition_code)
        db = standings_from_db(competition_code)
        return db if db.present?

        standings_from_api(competition_code)
      end

      def standings_from_db(competition_code)
        scope = Standing.includes(:team, :competition)
                        .for_competition(competition_code)
                        .where.not(group_name: [ nil, "" ])
                        .order(:group_name, :rank)
        return {} unless scope.exists?

        flat = scope.map { |s|
          {
            id:            s.id,
            rank:          s.rank,
            group_name:    s.group_name&.sub(/\AGroup\s+/i, ""),
            team:          { id: s.team.id, name: s.team.name, code: s.team.code, flag_url: s.team.flag_url },
            played:        s.played,
            won:           s.won,
            drawn:         s.drawn,
            lost:          s.lost,
            goals_for:     s.goals_for,
            goals_against: s.goals_against,
            goal_diff:     (s.goals_for || 0) - (s.goals_against || 0),
            points:        s.points
          }
        }
        flat.group_by { |s| s[:group_name] }
      end

      def standings_from_api(competition_code)
        league_id = AppFocus.league_id_for(competition_code)
        return {} unless league_id

        season = LiveScoresClient.new.current_season_for_league(league_id, competition_code)
        rows   = LiveScoresClient.new.league_standings(league_id, season)
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
      rescue => e
        Rails.logger.error("[StandingsController] API standings failed: #{e.message}")
        {}
      end
    end
  end
end
