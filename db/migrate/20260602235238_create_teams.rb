class CreateTeams < ActiveRecord::Migration[8.1]
  def change
    create_table :teams do |t|
      t.string :name
      t.string :code
      t.string :flag_url
      t.string :group
      t.string :confederation

      t.timestamps
    end
  end
end
