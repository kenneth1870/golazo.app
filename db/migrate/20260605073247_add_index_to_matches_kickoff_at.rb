class AddIndexToMatchesKickoffAt < ActiveRecord::Migration[8.1]
  def change
    add_index :matches, :kickoff_at unless index_exists?(:matches, :kickoff_at)
    add_index :matches, :status     unless index_exists?(:matches, :status)
  end
end
