class AddGeoToDevices < ActiveRecord::Migration[8.1]
  def change
    add_column :devices, :ip_address, :string
    add_column :devices, :city, :string
    add_column :devices, :region, :string
    add_column :devices, :country, :string
  end
end
