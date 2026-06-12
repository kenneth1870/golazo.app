class EnsureMexRsaMatch < ActiveRecord::Migration[8.1]
  def up
    wc_id  = execute("SELECT id FROM competitions WHERE code = 'WC' LIMIT 1").first&.fetch("id", nil)
    return unless wc_id

    mex_id = execute("SELECT id FROM teams WHERE code = 'MEX' LIMIT 1").first&.fetch("id", nil)
    rsa_id = execute("SELECT id FROM teams WHERE code = 'RSA' LIMIT 1").first&.fetch("id", nil)
    return unless mex_id && rsa_id

    existing = execute(<<~SQL).first
      SELECT id FROM matches
      WHERE home_team_id = #{mex_id} AND away_team_id = #{rsa_id} AND competition_id = #{wc_id}
      LIMIT 1
    SQL

    if existing
      # Ensure kickoff_at is correct in case it got corrupted
      execute(<<~SQL)
        UPDATE matches SET
          kickoff_at  = '2026-06-11 19:00:00 UTC',
          venue       = 'Estadio Azteca, Mexico City',
          group_stage = 'A',
          round       = 'Matchday 1',
          updated_at  = NOW()
        WHERE id = #{existing.fetch("id")}
          AND status NOT IN ('live', 'finished')
      SQL
    else
      execute(<<~SQL)
        INSERT INTO matches (home_team_id, away_team_id, competition_id, kickoff_at, venue, group_stage, round, status, created_at, updated_at)
        VALUES (#{mex_id}, #{rsa_id}, #{wc_id}, '2026-06-11 19:00:00 UTC', 'Estadio Azteca, Mexico City', 'A', 'Matchday 1', 'scheduled', NOW(), NOW())
      SQL
    end
  end

  def down; end
end
