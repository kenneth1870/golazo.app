class CreateSolidCacheEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :solid_cache_entries do |t|
      t.binary   :key,        null: false, limit: 1024
      t.binary   :value,      null: false, limit: 536870912
      t.datetime :created_at, null: false
      t.bigint   :key_hash,   null: false
      t.integer  :byte_size,  null: false

      t.index :byte_size,               name: "index_solid_cache_entries_on_byte_size"
      t.index [ :key_hash, :byte_size ],  name: "index_solid_cache_entries_on_key_hash_and_byte_size"
      t.index :key_hash, unique: true,  name: "index_solid_cache_entries_on_key_hash"
    end
  end
end
