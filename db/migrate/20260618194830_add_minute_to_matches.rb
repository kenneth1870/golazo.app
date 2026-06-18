class AddMinuteToMatches < ActiveRecord::Migration[8.1]
  def change
    add_column :matches, :minute, :integer
    add_column :matches, :minute_extra, :integer
  end
end
