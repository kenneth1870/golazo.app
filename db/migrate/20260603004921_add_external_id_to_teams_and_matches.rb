class AddExternalIdToTeamsAndMatches < ActiveRecord::Migration[8.1]
  def change
    add_column :teams, :external_id, :integer
    add_index  :teams, :external_id, unique: true

    add_column :matches, :external_id, :integer
    add_index  :matches, :external_id, unique: true
  end
end
