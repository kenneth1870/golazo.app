class CreateStandings < ActiveRecord::Migration[8.1]
  def change
    create_table :standings do |t|
      t.references :team, null: false, foreign_key: true
      t.integer :played
      t.integer :won
      t.integer :drawn
      t.integer :lost
      t.integer :goals_for
      t.integer :goals_against
      t.integer :points
      t.integer :rank
      t.string :group_name

      t.timestamps
    end
  end
end
