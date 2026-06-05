class AddKnockoutSupportToMatches < ActiveRecord::Migration[8.1]
  def up
    # Knockout fixtures exist before their teams are known (group winners /
    # runners-up / best third-placed are TBD until the group stage ends), so
    # the team columns must allow NULL.
    change_column_null :matches, :home_team_id, true
    change_column_null :matches, :away_team_id, true

    # Slot labels describe who fills each side until a real team is resolved
    # (e.g. "1A" = winner of Group A, "W73" = winner of bracket match 73).
    add_column :matches, :home_slot,   :string
    add_column :matches, :away_slot,   :string
    # Position of a knockout match within the whole bracket, used to wire
    # winners from one round into the next.
    add_column :matches, :bracket_pos, :integer

    add_index :matches, :bracket_pos
  end

  def down
    remove_index  :matches, :bracket_pos
    remove_column :matches, :bracket_pos
    remove_column :matches, :away_slot
    remove_column :matches, :home_slot

    # Only re-add NOT NULL if no rows would violate it.
    if !column_exists?(:matches, :home_team_id) || execute("SELECT 1 FROM matches WHERE home_team_id IS NULL OR away_team_id IS NULL LIMIT 1").none?
      change_column_null :matches, :home_team_id, false
      change_column_null :matches, :away_team_id, false
    end
  end
end
