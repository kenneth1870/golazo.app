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

  LATAM_LEAGUES = %w[CRC LMX].freeze

  def latam_league?(code)
    LATAM_LEAGUES.include?(code.to_s.upcase)
  end

  # Stacked jornada placeholders from API-Football are stored as Sunday 20:00 UTC (Z).
  # Real local kickoffs use offset timestamps (e.g. 2026-07-26T14:00:00-06:00) — do not shift those.
  def latam_jornada_stack_placeholder?(kickoff_at, code, round)
    return false unless latam_league?(code)
    return false unless round.to_s.match?(/Apertura|Clausura|Regular Season|Jornada/i)

    kickoff = Time.iso8601(kickoff_at.to_s)
    kickoff.utc.hour == 20 && kickoff.utc.min.zero? && kickoff.sec.zero? &&
      kickoff_at.to_s.match?(/(?:Z|\+00:00)\z/)
  rescue ArgumentError, TypeError
    false
  end

  # API-Football uses 20:00 UTC placeholders until real kickoff times are published.
  def crc_placeholder_kickoff?(kickoff_at, code, round)
    latam_jornada_stack_placeholder?(kickoff_at, code, round)
  end

  # Shift only stacked Sunday placeholders back to Thursday; keep real per-fixture dates.
  def adjusted_kickoff(kickoff_at, code, round)
    return kickoff_at unless latam_jornada_stack_placeholder?(kickoff_at, code, round)

    kickoff = Time.iso8601(kickoff_at.to_s)
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
      home_team: {
        name:     TeamDisplayNames.display_name(m.dig(:home, :name)),
        flag_url: TeamDisplayNames.flag_url(m.dig(:home, :name), m.dig(:home, :logo))
      },
      away_team: {
        name:     TeamDisplayNames.display_name(m.dig(:away, :name)),
        flag_url: TeamDisplayNames.flag_url(m.dig(:away, :name), m.dig(:away, :logo))
      }
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

  # API-Football can return two fixture ids for the same jornada slot after a rebrand
  # (e.g. Municipal Liberia + Escorpiones Belén). Collapse by league, round, team pair, date.
  def dedupe_fixture_matches(matches)
    scheduled, rest = matches.partition { |m| m[:status].to_s == "scheduled" }
    deduped = scheduled.each_with_object({}) do |m, acc|
      key = fixture_dedup_key(m)
      acc[key] = acc[key] ? pick_better_fixture(acc[key], m) : m
    end.values
    rest + deduped
  end

  def fixture_dedup_key(m)
    code  = m.dig(:competition, :code).to_s
    round = m[:round].to_s.downcase.strip
    home  = TeamDisplayNames.dedup_slug(m.dig(:home_team, :name))
    away  = TeamDisplayNames.dedup_slug(m.dig(:away_team, :name))
    pair  = [ home, away ].sort.join("|")
    # LATAM jornadas stack on Sunday with inconsistent placeholder dates — round + pair is enough.
    if latam_league?(code) && m[:status].to_s == "scheduled"
      "#{code}|#{round}|#{pair}"
    else
      date = m[:kickoff_at].to_s.first(10)
      "#{code}|#{round}|#{pair}|#{date}"
    end
  end

  def pick_better_fixture(a, b)
    score = lambda do |m|
      confirmed = m[:kickoff_tbc] ? 0 : 1
      names     = m.dig(:home_team, :name).to_s.length + m.dig(:away_team, :name).to_s.length
      ext       = m[:external_id].to_i
      [ confirmed, names, ext ]
    end
    (score.call(a) <=> score.call(b)) >= 0 ? a : b
  end

  def match_local_date?(kickoff_at, date, timezone)
    return false if kickoff_at.blank?

    zone = timezone.is_a?(TZInfo::Timezone) ? timezone : TZInfo::Timezone.get(timezone.to_s)
    zone.utc_to_local(Time.parse(kickoff_at.to_s).utc).to_date == date
  rescue ArgumentError, TZInfo::InvalidTimezoneIdentifier
    false
  end

  def competition_code_param
    (params[:competition_code] || params[:code]).to_s.upcase
  end
end
