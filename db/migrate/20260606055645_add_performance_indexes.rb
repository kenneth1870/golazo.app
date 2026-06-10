class AddPerformanceIndexes < ActiveRecord::Migration[8.1]
  def change
    # Speeds up Today/Fixtures queries that filter by competition then sort by kickoff
    add_index :matches, [ :competition_id, :kickoff_at ], name: "index_matches_on_competition_kickoff"

    # Speeds up live-score queries and status-filtered searches
    add_index :matches, [ :status, :kickoff_at ], name: "index_matches_on_status_kickoff"

    # Speeds up team profile page (all matches for a team sorted by time)
    add_index :matches, [ :home_team_id, :kickoff_at ], name: "index_matches_on_home_team_kickoff"
    add_index :matches, [ :away_team_id, :kickoff_at ], name: "index_matches_on_away_team_kickoff"
  end
end
