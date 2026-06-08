class CreatePushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_table :push_subscriptions do |t|
      t.text :endpoint, null: false
      t.string :p256dh, null: false
      t.string :auth, null: false
      t.string :device_id
      t.string :team_ids, default: "[]"   # JSON array of team names

      t.timestamps
    end

    add_index :push_subscriptions, :endpoint, unique: true
    add_index :push_subscriptions, :device_id
  end
end
