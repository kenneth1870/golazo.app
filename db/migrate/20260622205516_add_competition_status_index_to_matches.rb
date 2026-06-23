class AddCompetitionStatusIndexToMatches < ActiveRecord::Migration[8.1]
  def change
    add_index :matches, [ :competition_id, :status ], name: "index_matches_on_competition_id_and_status"
  end
end
