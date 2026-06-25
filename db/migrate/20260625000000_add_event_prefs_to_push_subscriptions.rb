class AddEventPrefsToPushSubscriptions < ActiveRecord::Migration[8.0]
  def change
    # JSON array of event types the subscriber wants. Empty array or NULL = all events.
    # Valid values: "goal", "kickoff", "fulltime", "halftime", "red_card", "prematch"
    add_column :push_subscriptions, :event_prefs, :text, default: "[]"
  end
end
