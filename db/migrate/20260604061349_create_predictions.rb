class CreatePredictions < ActiveRecord::Migration[8.1]
  def change
    create_table :predictions do |t|
      t.string  :match_external_id, null: false, index: { unique: true }
      t.integer :home_votes, default: 0, null: false
      t.integer :draw_votes, default: 0, null: false
      t.integer :away_votes, default: 0, null: false
      t.text    :voter_tokens, default: "[]", null: false

      t.timestamps
    end
  end
end
