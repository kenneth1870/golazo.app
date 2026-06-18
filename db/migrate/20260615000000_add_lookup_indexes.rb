class AddLookupIndexes < ActiveRecord::Migration[8.1]
  def change
    add_index :competitions, :code, unique: true
    add_index :teams, :code
    add_index :standings, [ :competition_id, :team_id ], unique: true
  end
end
