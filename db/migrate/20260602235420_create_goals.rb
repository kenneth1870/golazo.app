class CreateGoals < ActiveRecord::Migration[8.1]
  def change
    create_table :goals do |t|
      t.references :match, null: false, foreign_key: true
      t.references :team, null: false, foreign_key: true
      t.string :player_name
      t.integer :minute
      t.string :goal_type

      t.timestamps
    end
  end
end
