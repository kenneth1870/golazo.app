class CreateScorePredictions < ActiveRecord::Migration[8.1]
  def change
    create_table :score_predictions do |t|
      t.string  :device_id,        null: false
      t.string  :match_external_id, null: false
      t.string  :display_name
      t.integer :home_guess,       null: false
      t.integer :away_guess,       null: false
      t.integer :points_earned                  # null until match is finished & graded
      t.string  :home_team_name
      t.string  :away_team_name

      t.timestamps
    end
    add_index :score_predictions, [ :device_id, :match_external_id ], unique: true
    add_index :score_predictions, :device_id
    add_index :score_predictions, :points_earned
  end
end
