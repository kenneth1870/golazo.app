class Device < ApplicationRecord
  include UserAgentParser

  validates :device_id, presence: true, uniqueness: true

  # A heartbeat closer together than this counts as continuous engagement and
  # is added to engaged_seconds. A larger gap is treated as idle (not counted).
  CONTINUOUS_GAP   = 90    # seconds
  # A gap longer than this starts a new "session" (bumps visit_count).
  NEW_SESSION_GAP  = 30.minutes.to_i

  # Records a heartbeat from the client and accumulates engagement.
  # Returns the device.
  DEVICE_ID_FORMAT = /\A[\w\-]{8,64}\z/

  def self.track!(device_id:, user_agent: nil, locale: nil, path: nil, ip: nil)
    device_id = device_id.to_s.strip
    return nil if device_id.blank?
    return nil unless device_id.match?(DEVICE_ID_FORMAT)

    now = Time.current
    dev = find_or_initialize_by(device_id: device_id)

    if dev.new_record?
      dev.first_seen_at = now
      dev.visit_count   = 1
    else
      gap = (now - (dev.last_seen_at || now)).to_i
      dev.engaged_seconds += gap if gap.positive? && gap <= CONTINUOUS_GAP
      dev.visit_count     += 1   if gap >= NEW_SESSION_GAP
    end

    dev.last_seen_at = now
    dev.last_path    = path.to_s.first(255) if path.present?
    dev.locale       = locale.to_s.split("-").first.downcase if locale.present?
    dev.user_agent   = user_agent.to_s.first(500) if user_agent.present?

    # Track IP; enqueue geo lookup when it's new or has changed
    needs_geo = ip.present? && ip != dev.ip_address
    dev.ip_address = ip.to_s.first(64) if ip.present?

    dev.save!
    GeolocateDeviceJob.perform_later(dev.id) if needs_geo
    dev
  end

  # OS breakdown computed in SQL (os is derived from user_agent, not a column).
  def self.os_breakdown
    connection.select_rows(<<~SQL).to_h
      SELECT CASE
        WHEN user_agent ~* 'iphone|ipad|ipod'    THEN 'iOS'
        WHEN user_agent ~* 'android'             THEN 'Android'
        WHEN user_agent ~* 'windows'             THEN 'Windows'
        WHEN user_agent ~* 'mac os x|macintosh'  THEN 'macOS'
        WHEN user_agent ~* 'linux'               THEN 'Linux'
        ELSE 'Unknown'
      END AS os, COUNT(*)
      FROM devices
      GROUP BY 1
      ORDER BY 2 DESC
    SQL
  end

  # Human-readable engaged time, e.g. "2h 14m", "8m", "—".
  def engaged_human
    s = engaged_seconds.to_i
    return "—" if s.zero?
    h = s / 3600
    m = (s % 3600) / 60
    return "#{h}h #{m}m" if h.positive?
    return "#{m}m"       if m.positive?
    "<1m"
  end

  def admin_summary(push_device_ids = nil)
    {
      id:              id,
      device_id:       device_id,
      browser:         browser,
      os:              os,
      locale:          locale,
      visit_count:     visit_count,
      engaged_seconds: engaged_seconds,
      engaged_human:   engaged_human,
      last_path:       last_path,
      push_enabled:    push_device_ids ? push_device_ids.include?(device_id) : nil,
      first_seen_at:   first_seen_at&.iso8601,
      last_seen_at:    last_seen_at&.iso8601,
      ip_address:      ip_address,
      city:            city,
      region:          region,
      country:         country
    }
  end
end
