class CreateMatches < ActiveRecord::Migration[8.1]
  def change
    create_table :matches do |t|
      t.references :home_team, null: false, foreign_key: { to_table: :teams }
      t.references :away_team, null: false, foreign_key: { to_table: :teams }
      t.integer :home_score
      t.integer :away_score
      t.string :status
      t.datetime :kickoff_at
      t.string :venue
      t.string :group_stage
      t.string :round

      t.timestamps
    end
  end
end
