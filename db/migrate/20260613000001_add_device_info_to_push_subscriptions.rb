class AddDeviceInfoToPushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    # locale: which language to send notification copy in (app default is Spanish)
    add_column :push_subscriptions, :locale,       :string,   default: "es"
    # user_agent: raw UA string captured at subscribe time, for the admin device list
    add_column :push_subscriptions, :user_agent,   :string
    # last_seen_at: bumped whenever the device re-subscribes or updates its teams
    add_column :push_subscriptions, :last_seen_at, :datetime
  end
end
