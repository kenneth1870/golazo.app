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

  # competition_codes is stored as a JSON string array, e.g. '["PL","CRC"]'
  def competition_codes_list
    return [] unless has_attribute?(:competition_codes)
    list = JSON.parse(competition_codes || "[]")
    list.is_a?(Array) ? list.map(&:to_s).reject(&:blank?) : []
  rescue JSON::ParserError => e
    Rails.logger.warn("[PushSubscription##{id}] Invalid competition_codes JSON: #{e.message}")
    []
  end

  def competition_codes_list=(arr)
    self.competition_codes = Array(arr).map(&:to_s).reject(&:blank?).uniq.to_json
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

  # Subscribers who opted into specific teams and/or leagues only.
  # Empty team_ids AND empty competition_codes means no notifications (must opt in).
  def self.for_match(home_name:, away_name:, competition_code: nil)
    home_name = home_name.to_s
    away_name = away_name.to_s
    competition_code = competition_code.to_s.upcase.presence

    team_match_sql = <<~SQL.squish
      EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(team_ids::jsonb) AS t(name)
        WHERE lower(t.name) = lower(:home_name) OR lower(t.name) = lower(:away_name)
      )
    SQL

    has_teams = "team_ids IS NOT NULL AND team_ids NOT IN ('[]', 'null') AND jsonb_array_length(team_ids::jsonb) > 0"
    has_leagues = if column_names.include?("competition_codes")
      "competition_codes IS NOT NULL AND competition_codes NOT IN ('[]', 'null') AND jsonb_array_length(competition_codes::jsonb) > 0"
    end

    binds = { home_name: home_name, away_name: away_name }
    clauses = []

    if has_leagues && competition_code.present?
      league_match_sql = <<~SQL.squish
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(competition_codes::jsonb) AS c(code)
          WHERE upper(c.code) = :competition_code
        )
      SQL
      binds[:competition_code] = competition_code
      clauses << "(#{has_teams} AND (#{team_match_sql})) OR (#{has_leagues} AND (#{league_match_sql}))"
    else
      clauses << "(#{has_teams} AND (#{team_match_sql}))"
    end

    where(clauses.join(" OR "), **binds)
  end

  # Legacy helper — kept for admin broadcast by team name.
  def self.for_teams(names)
    names = Array(names).map(&:to_s).reject(&:blank?)
    return none if names.blank?

    lower_names = names.map(&:downcase)
    where(
      "team_ids IS NOT NULL AND team_ids NOT IN ('[]', 'null') AND " \
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

  def admin_summary
    teams = team_names
    leagues = competition_codes_list
    {
      id:           id,
      device_id:    device_id,
      provider:     push_provider,
      browser:      browser,
      os:           os,
      locale:       locale,
      teams:        teams,
      leagues:      leagues,
      global:       teams.empty? && leagues.empty?,
      last_seen_at: (last_seen_at || updated_at)&.iso8601,
      created_at:   created_at&.iso8601
    }
  end
end
