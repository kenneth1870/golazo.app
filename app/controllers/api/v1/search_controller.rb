module Api
  module V1
    class SearchController < BaseController
      def index
        q = params[:q].to_s.strip
        return render json: [] if q.length < 2

        teams = Team
          .where("name ILIKE :q OR code ILIKE :q", q: "%#{q}%")
          .limit(6)
          .map { |t| serialize_team(t) }

        now = Time.current
        matches = Match
          .includes(:home_team, :away_team)
          .joins(:home_team, :away_team)
          .where(
            "teams.name ILIKE :q OR away_teams_matches.name ILIKE :q",
            q: "%#{q}%"
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
          .map do |m|
            home = m.home_team
            away = m.away_team
            {
              type:        "match",
              id:          m.id,
              external_id: m.external_id,
              home:        TeamDisplayNames.display_name(home&.name),
              away:        TeamDisplayNames.display_name(away&.name),
              home_flag:   TeamDisplayNames.flag_url(home&.name, home&.flag_url),
              away_flag:   TeamDisplayNames.flag_url(away&.name, away&.flag_url),
              home_score:  m.home_score,
              away_score:  m.away_score,
              status:      m.status,
              kickoff_at:  m.kickoff_at
            }
          end

        render json: teams + matches
      rescue => e
        Rails.logger.error("[SearchController] #{e.message}")
        render json: []
      end

      private

      def serialize_team(team)
        {
          type:     "team",
          id:       team.id,
          name:     TeamDisplayNames.display_name(team.name),
          code:     team.code,
          flag_url: TeamDisplayNames.flag_url(team.name, team.flag_url),
          group:    team.group
        }
      end
    end
  end
end
