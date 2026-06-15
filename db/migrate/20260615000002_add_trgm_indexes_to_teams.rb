class AddTrgmIndexesToTeams < ActiveRecord::Migration[8.1]
  def up
    enable_extension "pg_trgm"
    add_index :teams, :name, using: :gin, opclass: :gin_trgm_ops, name: "index_teams_on_name_trgm"
    add_index :teams, :code, using: :gin, opclass: :gin_trgm_ops, name: "index_teams_on_code_trgm"
  end

  def down
    remove_index :teams, name: "index_teams_on_name_trgm"
    remove_index :teams, name: "index_teams_on_code_trgm"
    disable_extension "pg_trgm"
  end
end
