module Api
  module V1
    class TeamsController < BaseController
      # Seeded showcase clubs — maps short DB codes to live league pages.
      DB_CLUB_CODE_TO_LEAGUE = {
        "ARS" => "PL", "MCI" => "PL", "LIV" => "PL", "CHE" => "PL", "TOT" => "PL", "MUN" => "PL",
        "NEW" => "PL", "AVL" => "PL", "BHA" => "PL", "WHU" => "PL",
        "RMA" => "LAL", "BAR" => "LAL", "ATM" => "LAL", "SEV" => "LAL", "RSO" => "LAL", "ATH" => "LAL",
        "VIL" => "LAL", "VAL" => "LAL",
        "BAY" => "BL1", "BVB" => "BL1", "RBL" => "BL1", "B04" => "BL1", "SGE" => "BL1", "WOB" => "BL1",
        "INT" => "SA", "ACM" => "SA", "JUV" => "SA", "ROM" => "SA", "NAP" => "SA", "LAZ" => "SA",
        "ATL" => "SA", "FIO" => "SA",
        "PSG" => "L1", "MON" => "L1", "OLM" => "L1", "OLY" => "L1", "LIL" => "L1", "NIC" => "L1",
        "LAF" => "MLS", "MIA" => "MLS", "TIM" => "MLS", "SEA" => "MLS", "NYC" => "MLS", "ATU" => "MLS"
      }.freeze

      def index
        teams = Team.order(:group, :name)
        teams = teams.where.not(group: [ nil, "" ]) if params[:competition] == "WC" || params[:wc] == "1"
        render json: teams.map { |t| serialize_team(t) }
      end

      def show
        team = Team.find(params[:id])

        if AppFocus.wc_paused?
          payload = serialize_team(team).merge(
            matches:          [],
            scorers:          [],
            tournament_stats: nil
          )
          if team.group.present?
            return render json: payload.merge(wc_archived: true, redirect: "/leagues")
          end

          league_code = DB_CLUB_CODE_TO_LEAGUE[team.code]
          if league_code
            slug = TeamDisplayNames.slug_for(team.name)
            return render json: payload.merge(
              club_league_code: league_code,
              club_slug:        slug,
              redirect:         "/leagues/#{league_code}/teams/#{slug}"
            )
          end

          return render json: payload.merge(redirect: "/leagues")
        end

        matches = Match.where("home_team_id = ? OR away_team_id = ?", team.id, team.id)
                       .includes(:home_team, :away_team, :competition)
                       .order(:kickoff_at)

        # Tournament goal scorers from our own DB (no external API needed)
        scorers = team.goals
                      .where.not(player_name: [ nil, "" ])
                      .where(goal_type: [ nil, "regular", "penalty", "own_goal" ])
                      .group(:player_name, :goal_type)
                      .count
                      .each_with_object({}) do |((name, type), count), h|
                        h[name] ||= { name: name, goals: 0, own_goals: 0 }
                        if type == "own_goal"
                          h[name][:own_goals] += count
                        else
                          h[name][:goals] += count
                        end
                      end
                      .values
                      .select { |s| s[:goals] > 0 }
                      .sort_by { |s| -s[:goals] }

        # Tournament summary stats pushed to SQL — no Ruby iteration over match rows
        finished = Match.where("home_team_id = ? OR away_team_id = ?", team.id, team.id)
                        .where(status: "finished")
        played = finished.count
        row = finished.pick(
          Arel.sql("SUM(CASE WHEN home_team_id = #{team.id} THEN home_score ELSE away_score END)"),
          Arel.sql("SUM(CASE WHEN home_team_id = #{team.id} THEN away_score ELSE home_score END)"),
          Arel.sql("SUM(CASE WHEN home_team_id = #{team.id} AND away_score = 0 THEN 1 WHEN away_team_id = #{team.id} AND home_score = 0 THEN 1 ELSE 0 END)")
        )
        goals_scored, goals_conceded, clean_sheets = row&.map(&:to_i) || [ 0, 0, 0 ]

        tournament_stats = {
          played:         played,
          goals_scored:   goals_scored,
          goals_conceded: goals_conceded,
          clean_sheets:   clean_sheets,
          goal_diff:      goals_scored - goals_conceded
        }

        # Serialize matches minimally — the team page renders a fixture list and
        # never touches goals/match_stats, so excluding them avoids an N+1 over
        # those associations (they aren't preloaded) and trims the payload.
        # Mirrors MatchesController#index.
        matches_json = matches.map { |m|
          json = m.as_json(
            only:    %i[id external_id status kickoff_at home_score away_score home_slot away_slot bracket_pos group_stage round],
            include: {
              home_team:   { only: %i[id name code flag_url] },
              away_team:   { only: %i[id name code flag_url] },
              competition: { only: %i[id name code logo country] }
            }
          )
          json["home_team"] = normalize_team_json(json["home_team"]) if json["home_team"]
          json["away_team"] = normalize_team_json(json["away_team"]) if json["away_team"]
          json
        }

        render json: serialize_team(team).merge(
          matches: matches_json,
          scorers: scorers,
          tournament_stats: tournament_stats
        )
      end

      # GET /api/v1/teams/:id/squad
      # Fetches squad from API-Sports v3, cached for 24h
      def squad
        team = Team.find(params[:id])
        api_key = ENV["APISPORTS_KEY"].presence

        unless api_key && team.external_id.present?
          return render json: { players: [], coach: nil }
        end

        cache_key = "team_squad_#{team.external_id}"
        data = Rails.cache.fetch(cache_key, expires_in: 24.hours, race_condition_ttl: 30.seconds) do
          resp = Faraday.new("https://v3.football.api-sports.io") do |f|
            f.headers["x-apisports-key"] = api_key
          end.get("/players/squads", { team: team.external_id })

          if resp.success?
            body = JSON.parse(resp.body)
            raw  = body.dig("response", 0) || {}
            players = Array(raw["players"]).map do |p|
              {
                id:       p["id"],
                name:     p["name"],
                age:      p["age"],
                number:   p["number"],
                position: p["position"],
                photo:    p["photo"]
              }
            end
            { players: players, coach: nil }
          else
            { players: [], coach: nil }
          end
        rescue => e
          Rails.logger.error("[TeamsController#squad] #{e.message}")
          { players: [], coach: nil }
        end

        render json: data
      end

      private

      def serialize_team(team)
        normalize_team_json(
          team.as_json(only: %i[id name code flag_url group confederation external_id])
        )
      end

      def normalize_team_json(team_hash)
        return team_hash unless team_hash.is_a?(Hash) && team_hash["name"].present?

        team_hash.merge(
          "name"     => TeamDisplayNames.display_name(team_hash["name"]),
          "flag_url" => TeamDisplayNames.flag_url(team_hash["name"], team_hash["flag_url"])
        )
      end
    end
  end
end
