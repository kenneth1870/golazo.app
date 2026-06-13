class CreateDevices < ActiveRecord::Migration[8.1]
  def change
    create_table :devices do |t|
      t.string   :device_id, null: false
      t.string   :user_agent
      t.string   :locale, default: "es"
      t.string   :last_path
      t.datetime :first_seen_at
      t.datetime :last_seen_at
      t.integer  :visit_count,     default: 0, null: false  # number of distinct sessions
      t.integer  :engaged_seconds, default: 0, null: false  # cumulative foreground time
      t.timestamps
    end
    add_index :devices, :device_id, unique: true
    add_index :devices, :last_seen_at
  end
end
