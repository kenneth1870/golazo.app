module ApiMatchNormalizer
  extend ActiveSupport::Concern

  LEAGUE_ID_TO_CODE = {
    1   => "WC",
    2   => "UCL",
    39  => "PL",
    78  => "BL1",
    135 => "SA",
    140 => "LAL",
    61  => "L1",
    253 => "MLS",
    162 => "CRC",
    262 => "LMX"
  }.freeze

  LEAGUE_CANONICAL_NAMES = {
    1   => "FIFA World Cup 2026",
    2   => "UEFA Champions League",
    39  => "Premier League",
    140 => "La Liga",
    78  => "Bundesliga",
    135 => "Serie A",
    61  => "Ligue 1",
    253 => "Major League Soccer",
    162 => "Liga Tica",
    262 => "Liga MX"
  }.freeze

  private

  def league_code(league_id)
    LEAGUE_ID_TO_CODE[league_id.to_i] || league_id.to_s
  end

  # API-Football uses 20:00 UTC for every Liga Tica jornada until real times are published.
  def crc_placeholder_kickoff?(kickoff_at, code, round)
    return false unless code.to_s.upcase == "CRC"
    return false unless round.to_s.match?(/Apertura|Clausura/i)

    kickoff = Time.iso8601(kickoff_at.to_s)
    kickoff.utc.hour == 20 && kickoff.utc.min.zero? && kickoff.sec.zero?
  rescue ArgumentError, TypeError
    false
  end

  # API-Football stacks every Liga Tica jornada on Sunday; real fechas start on Thursday.
  def adjusted_kickoff(kickoff_at, code, round)
    return kickoff_at unless code.to_s.upcase == "CRC"
    return kickoff_at unless round.to_s.match?(/Apertura|Clausura/i)

    kickoff = Time.iso8601(kickoff_at.to_s)
    return kickoff_at unless kickoff.wday == 0

    (kickoff - 3.days).iso8601
  rescue ArgumentError, TypeError
    kickoff_at
  end

  def normalize_api_match(m)
    league_id = m[:league_id].to_i
    code      = league_code(league_id)
    {
      id:          "ext_#{m[:external_id]}",
      external_id: m[:external_id],
      status:      m[:status],
      minute:      m[:minute],
      minute_extra: m[:minute_extra],
      kickoff_at:  adjusted_kickoff(m[:kickoff_at], code, m[:round]),
      kickoff_tbc: crc_placeholder_kickoff?(m[:kickoff_at], code, m[:round]),
      home_score:     m.dig(:home, :score),
      away_score:     m.dig(:away, :score),
      home_pen_score: m.dig(:home, :pen_score),
      away_pen_score: m.dig(:away, :pen_score),
      round:       m[:round],
      group_stage: nil,
      competition: {
        id:      code,
        name:    LEAGUE_CANONICAL_NAMES[league_id] || m[:league_name],
        code:    code,
        logo:    m[:league_logo],
        country: m[:league_country]
      },
      home_red_cards: m.dig(:home, :red_cards).to_i,
      away_red_cards: m.dig(:away, :red_cards).to_i,
      home_team: { name: m.dig(:home, :name), flag_url: m.dig(:home, :logo) },
      away_team: { name: m.dig(:away, :name), flag_url: m.dig(:away, :logo) }
    }
  end

  def filter_matches_for_focus(matches)
    matches.select { |m| AppFocus.important_match?(m) }
  end

  def filter_matches_for_competition(matches, code)
    league_id = AppFocus.league_id_for(code)
    return [] unless league_id

    matches.select { |m| m[:league_id].to_i == league_id && !AppFocus.excluded_match?(m) }
  end

  def competition_code_param
    (params[:competition_code] || params[:code]).to_s.upcase
  end
end
