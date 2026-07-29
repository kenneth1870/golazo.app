class AddIndexMatchesCompetitionGroupStage < ActiveRecord::Migration[8.0]
  def change
    add_index :matches, [ :competition_id, :group_stage ],
              name: "index_matches_on_competition_group_stage"
  end
end
