class AddCompetitionCodesToPushSubscriptions < ActiveRecord::Migration[8.1]
  def change
    add_column :push_subscriptions, :competition_codes, :text, default: "[]", null: false
  end
end
