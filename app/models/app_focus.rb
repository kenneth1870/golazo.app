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
    "CRC" => 162,
    "WC"  => 1
  }.freeze

  FEATURED_CLUB_CODES = %w[PL LAL BL1 SA L1 UCL MLS CRC].freeze

  # Top domestic leagues — used for empty-day previews (no UCL qualifiers).
  DOMESTIC_CLUB_CODES = %w[PL LAL BL1 SA L1 MLS CRC].freeze

  EXCLUDED_ROUND_PATTERN = /qualif|preliminary|play.?off|\b1st round\b|\b2nd round\b|\b3rd round\b/i.freeze

  # League IDs we surface in the product — everything else is ignored.
  def featured_league_ids
    FEATURED_CLUB_CODES.filter_map { |code| league_id_for(code) }
  end

  def allowed_league_ids
    case FOCUS
    when "wc"
      [ league_id_for("WC") ].compact
    when "both"
      featured_league_ids + [ league_id_for("WC") ].compact
    else
      featured_league_ids
    end
  end

  def allowed_league?(league_id)
    allowed_league_ids.include?(league_id.to_i)
  end

  def domestic_league_ids
    DOMESTIC_CLUB_CODES.filter_map { |code| league_id_for(code) }
  end

  # Drop early-round European qualifiers and other low-value fixtures.
  def excluded_match?(match)
    round  = match[:round].to_s
    league = match[:league_name].to_s
    return true if round.match?(EXCLUDED_ROUND_PATTERN)
    return true if league.match?(EXCLUDED_ROUND_PATTERN)
    return true if league.match?(/friendlies?\b/i)
    false
  end

  def important_match?(match)
    allowed_league?(match[:league_id]) && !excluded_match?(match)
  end

  def league_id_for(code)
    LEAGUE_IDS[code.to_s.upcase]
  end
end
