class GeolocateDeviceJob < ApplicationJob
  queue_as :default

  PRIVATE_RANGES = [
    /\A127\./,
    /\A10\./,
    /\A192\.168\./,
    /\A172\.(1[6-9]|2\d|3[01])\./,
    /\A::1\z/,
    /\Alocalhost\z/i
  ].freeze

  def perform(device_id)
    device = Device.find_by(id: device_id)
    return unless device&.ip_address.present?
    return if PRIVATE_RANGES.any? { |r| device.ip_address.match?(r) }

    conn = Faraday.new(url: "https://ipinfo.io") do |f|
      f.options.timeout      = 4
      f.options.open_timeout = 3
    end

    resp = conn.get("/#{URI.encode_uri_component(device.ip_address)}/json")
    return unless resp.success?

    data = JSON.parse(resp.body)
    return if data["bogon"] || data["error"].present?

    device.update_columns(
      city:    data["city"].presence,
      region:  data["region"].presence,
      country: data["country"].presence
    )
  rescue => e
    Rails.logger.warn("[GeolocateDeviceJob] #{e.class}: #{e.message}")
  end
end
