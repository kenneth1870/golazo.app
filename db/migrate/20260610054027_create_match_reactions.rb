class CreateMatchReactions < ActiveRecord::Migration[8.1]
  def change
    create_table :match_reactions do |t|
      t.string  :match_id, null: false
      t.string  :emoji,    null: false
      t.integer :count,    null: false, default: 0

      t.timestamps
    end
    add_index :match_reactions, [ :match_id, :emoji ], unique: true
    add_index :match_reactions, :match_id
  end
end
