class CreateMatchStats < ActiveRecord::Migration[8.1]
  def change
    create_table :match_stats do |t|
      t.references :match, null: false, foreign_key: true
      t.references :team, null: false, foreign_key: true
      t.integer :possession
      t.integer :shots
      t.integer :shots_on_target
      t.integer :corners
      t.integer :fouls
      t.integer :yellow_cards
      t.integer :red_cards
      t.integer :offsides

      t.timestamps
    end
  end
end
