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
    return none if names.blank?
    # Use PostgreSQL's jsonb ?| operator to filter in-database — avoids loading
    # every row into Ruby memory.  ??| is the Rails-escaped form of ?| so the
    # ?  character is not mistaken for a bind-parameter placeholder.
    where("team_ids::jsonb ??| array[:names]", names: names.map(&:to_s))
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
end
