class AddBlockedAtToUsersAndDevices < ActiveRecord::Migration[8.1]
  def change
    add_column :users,   :blocked_at, :datetime
    add_column :devices, :blocked_at, :datetime
    add_index  :devices, :blocked_at
  end
end
