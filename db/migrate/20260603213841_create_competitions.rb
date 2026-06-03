class CreateCompetitions < ActiveRecord::Migration[8.1]
  def change
    create_table :competitions do |t|
      t.string  :name,             null: false
      t.string  :code,             null: false
      t.string  :logo
      t.string  :country
      t.string  :competition_type
      t.integer :external_id
      t.integer :current_season_id

      t.timestamps
    end
    add_index :competitions, :code,        unique: true
    add_index :competitions, :external_id, unique: true
  end
end
