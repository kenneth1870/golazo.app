class PushSubscription < ApplicationRecord
  validates :endpoint, presence: true, uniqueness: true
  validates :p256dh, :auth, presence: true

  # team_ids is stored as a JSON string array, e.g. '["Argentina","Brazil"]'
  def team_names
    JSON.parse(team_ids || "[]")
  rescue JSON::ParserError
    []
  end

  def team_names=(arr)
    self.team_ids = arr.to_json
  end

  def self.for_teams(names)
    names = Array(names).map(&:to_s).reject(&:blank?)
    return none if names.blank?
    # Include subscriptions that match one of the team names OR subscriptions
    # with no team filter (team_ids = '[]') which means "all WC matches".
    # Blank team names are stripped above so empty strings never match the
    # all-WC bucket and produce garbled "⏰  vs " notifications.
    where(
      "team_ids = '[]' OR team_ids::jsonb ??| array[:names]",
      names: names
    )
  end

  def web_push_message(title:, body:, url: "/", icon: "/images/apple-touch-icon.png?v=2")
    {
      message: { title: title, body: body },
      endpoint: endpoint,
      p256dh: p256dh,
      auth: auth,
      vapid: {
        subject:     ENV["VAPID_SUBJECT"],
        public_key:  ENV["VAPID_PUBLIC_KEY"],
        private_key: ENV["VAPID_PRIVATE_KEY"]
      },
      data: {
        url:  url,
        icon: icon,
        badge: "/images/badge-72.png"
      }
    }
  end

  # ── Device introspection (for the admin device list) ──────────────────
  # The push endpoint host reveals which push service the browser uses,
  # which is a reliable proxy for the browser family.
  def push_provider
    host = (URI.parse(endpoint).host rescue nil).to_s
    case host
    when /fcm\.googleapis|googleapis/ then "Chrome / Android"
    when /push\.apple/                then "Safari / iOS"
    when /mozilla|push\.services/     then "Firefox"
    when /notify\.windows|wns/        then "Edge / Windows"
    else "Other"
    end
  end

  def browser
    ua = user_agent.to_s
    return "Unknown" if ua.blank?
    case ua
    when /Edg\//      then "Edge"
    when /CriOS|Chrome/ then "Chrome"
    when /FxiOS|Firefox/ then "Firefox"
    when /Safari/     then "Safari"
    else "Other"
    end
  end

  def os
    ua = user_agent.to_s
    case ua
    when /iPhone|iPad|iPod/ then "iOS"
    when /Android/          then "Android"
    when /Windows/          then "Windows"
    when /Mac OS X|Macintosh/ then "macOS"
    when /Linux/            then "Linux"
    else "Unknown"
    end
  end

  # Compact summary used by the admin devices endpoint.
  def admin_summary
    {
      id:           id,
      device_id:    device_id,
      provider:     push_provider,
      browser:      browser,
      os:           os,
      locale:       locale,
      teams:        team_names,
      global:       team_names.empty?,
      last_seen_at: (last_seen_at || updated_at)&.iso8601,
      created_at:   created_at&.iso8601
    }
  end
end
