module Api
  module V1
    class StandingsController < BaseController
      def index
        competition_code = params[:competition].presence || "WC"
        # DB standings are updated by SyncStandingsJob every 30 min — caching the
        # serialized result for 15/30 min avoids hundreds of redundant DB queries.
        ttl = competition_code == "WC" ? 3.minutes : 30.minutes

        result = Rails.cache.fetch("standings_#{competition_code}", expires_in: ttl) do
          scope = Standing.includes(:team, :competition)
                          .for_competition(competition_code)
                          .where.not(group_name: [ nil, "" ])
                          .order(:group_name, :rank)

          # Build a skeleton of all WC teams keyed by group so we can fill gaps.
          wc_teams_by_group = Team.where.not(group: [ nil, "" ])
                                  .order(:group, :name)
                                  .group_by(&:group)

          if scope.exists?
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
            grouped = flat.group_by { |s| s[:group_name] }

            # Pad any group that has fewer rows than expected with zero-stat entries
            # for teams not yet in the DB standings (e.g. match result not synced yet).
            wc_teams_by_group.each do |group_letter, teams|
              existing_team_ids = (grouped[group_letter] || []).map { |s| s[:team][:id] }.to_set
              missing = teams.reject { |t| existing_team_ids.include?(t.id) }
              next if missing.empty?

              next_rank = (grouped[group_letter]&.length || 0) + 1
              missing.each_with_index do |t, i|
                (grouped[group_letter] ||= []) << {
                  rank: next_rank + i,
                  group_name: group_letter,
                  team: { id: t.id, name: t.name, code: t.code, flag_url: t.flag_url },
                  played: 0, won: 0, drawn: 0, lost: 0,
                  goals_for: 0, goals_against: 0, goal_diff: 0, points: 0
                }
              end
            end

            grouped
          else
            # Before tournament begins: build standings skeleton from seeded WC teams
            wc_teams_by_group.transform_values.with_index do |teams, _|
              teams.each_with_index.map do |t, i|
                {
                  rank:          i + 1,
                  group_name:    t.group,
                  team:          { id: t.id, name: t.name, code: t.code, flag_url: t.flag_url },
                  played: 0, won: 0, drawn: 0, lost: 0,
                  goals_for: 0, goals_against: 0, goal_diff: 0, points: 0
                }
              end
            end
          end
        end

        render json: result
      end
    end
  end
end
