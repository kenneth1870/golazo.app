class AddLineupsNotifiedAtToMatches < ActiveRecord::Migration[8.1]
  def change
    add_column :matches, :lineups_notified_at, :datetime
  end
end
