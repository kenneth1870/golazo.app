class BackfillGroupStageFromTeamGroup < ActiveRecord::Migration[8.0]
  def up
    # Fix WC group-stage matches that are missing group_stage.
    # Uses the teams.group column (set during team seed/import) as the source of truth.
    # Runs idempotently — only touches rows where group_stage IS NULL.
    execute <<~SQL
      UPDATE matches
      SET group_stage = home_teams.group
      FROM teams AS home_teams
      JOIN teams AS away_teams ON away_teams.id = matches.away_team_id
      JOIN competitions ON competitions.id = matches.competition_id
      WHERE matches.home_team_id = home_teams.id
        AND matches.group_stage IS NULL
        AND competitions.code = 'WC'
        AND home_teams.group IS NOT NULL
        AND home_teams.group != ''
        AND home_teams.group = away_teams.group
    SQL
  end

  def down
    # Not reversible — group_stage could have been NULL intentionally
  end
end
