class PushSubscription < ApplicationRecord
  include UserAgentParser

  validates :endpoint, presence: true, uniqueness: true
  validates :p256dh, :auth, presence: true

  # team_ids is stored as a JSON string array, e.g. '["Argentina","Brazil"]'
  def team_names
    JSON.parse(team_ids || "[]")
  rescue JSON::ParserError => e
    Rails.logger.warn("[PushSubscription##{id}] Invalid team_ids JSON: #{e.message}")
    []
  end

  def team_names=(arr)
    self.team_ids = arr.to_json
  end

  VALID_EVENT_TYPES = %w[goal kickoff fulltime halftime red_card prematch].freeze

  # Returns the list of subscribed event types. Empty array means all events.
  def event_prefs_list
    return [] unless has_attribute?(:event_prefs)
    list = JSON.parse(event_prefs || "[]")
    list.is_a?(Array) ? list.map(&:to_s) & VALID_EVENT_TYPES : []
  rescue JSON::ParserError
    []
  end

  # Returns true if this subscriber wants to receive the given event type.
  def receives_event?(event_type)
    prefs = event_prefs_list
    prefs.empty? || prefs.include?(event_type.to_s)
  end

  def self.for_teams(names)
    names = Array(names).map(&:to_s).reject(&:blank?)
    return none if names.blank?
    # Global subscribers: team_ids is empty array, NULL, or the JSON string 'null'
    # (older rows may have NULL from before the column default was set).
    # Team-specific: team_ids JSON array contains one of the match team names.
    #
    # Case-insensitive match: unnest the stored JSON array and compare lowercased
    # values so subscriptions created with any casing ("brazil", "BRAZIL", etc.)
    # still receive notifications. jsonb_exists_any is case-sensitive, so we use
    # jsonb_array_elements_text + lower() instead.
    lower_names = names.map(&:downcase)
    where(
      "team_ids IS NULL OR team_ids IN ('[]', 'null') OR " \
      "EXISTS (SELECT 1 FROM jsonb_array_elements_text(team_ids::jsonb) AS t(name) WHERE lower(t.name) = ANY(array[:names]))",
      names: lower_names
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
