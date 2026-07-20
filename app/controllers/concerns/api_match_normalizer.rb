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
    162 => "CRC"
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
    162 => "Liga Tica"
  }.freeze

  private

  def league_code(league_id)
    LEAGUE_ID_TO_CODE[league_id.to_i] || league_id.to_s
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
      kickoff_at:  m[:kickoff_at],
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

    matches.select { |m| m[:league_id].to_i == league_id }
  end
end
