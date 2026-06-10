module Api
  module V1
    class SearchController < BaseController
      def index
        q = params[:q].to_s.strip
        return render json: [] if q.length < 2

        teams = Team
          .where("name ILIKE :q OR code ILIKE :q", q: "%#{q}%")
          .limit(6)
          .map { |t| { type: "team", id: t.id, name: t.name, code: t.code, flag_url: t.flag_url, group: t.group } }

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
            {
              type:       "match",
              id:         m.id,
              external_id: m.external_id,
              home:       m.home_team&.name,
              away:       m.away_team&.name,
              home_flag:  m.home_team&.flag_url,
              away_flag:  m.away_team&.flag_url,
              home_score: m.home_score,
              away_score: m.away_score,
              status:     m.status,
              kickoff_at: m.kickoff_at
            }
          end

        render json: teams + matches
      rescue => e
        Rails.logger.error("[SearchController] #{e.message}")
        render json: []
      end
    end
  end
end
