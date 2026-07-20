# Controls whether the product surface prioritises club football or WC 2026.
# Set APP_FOCUS=clubs (default), wc, or both via environment variable.
module AppFocus
  FOCUS = ENV.fetch("APP_FOCUS", "clubs").freeze

  module_function

  def clubs_primary?
    FOCUS == "clubs" || FOCUS == "both"
  end

  def wc_primary?
    FOCUS == "wc" || FOCUS == "both"
  end

  def wc_paused?
    FOCUS == "clubs"
  end

  def push_enabled?
    ENV.fetch("PUSH_NOTIFICATIONS", "paused") == "enabled"
  end

  def notifications_paused?
    !push_enabled?
  end

  # API-Football league IDs for seeded club competitions.
  LEAGUE_IDS = {
    "PL"  => 39,
    "LAL" => 140,
    "BL1" => 78,
    "SA"  => 135,
    "L1"  => 61,
    "UCL" => 2,
    "MLS" => 253,
    "WC"  => 1
  }.freeze

  FEATURED_CLUB_CODES = %w[PL LAL BL1 SA L1 UCL MLS].freeze

  def league_id_for(code)
    LEAGUE_IDS[code.to_s.upcase]
  end
end
