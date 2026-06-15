class AddSolidCacheCreatedAtIndex < ActiveRecord::Migration[8.1]
  def change
    add_index :solid_cache_entries, :created_at
  end
end
