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
    162  => "CRC",
    262  => "LMX",
    1028 => "CAC",
    16   => "CCC"
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
    162  => "Liga Tica",
    262  => "Liga MX",
    1028 => "Copa Centroamericana",
    16   => "Concachampions"
  }.freeze

  private

  def league_code(league_id)
    LEAGUE_ID_TO_CODE[league_id.to_i] || league_id.to_s
  end

  LATAM_LEAGUES = %w[CRC LMX CAC CCC].freeze

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

  FIXTURE_REFRESH_CAP = 8
  RESULTS_REFRESH_CAP = 4
  REFRESH_TIME_BUDGET_SEC = 4.0

  # Reconcile stale date-list rows against the live feed + per-fixture lookup.
  def refresh_club_fixtures(matches, include_live: true, refresh_cap: FIXTURE_REFRESH_CAP)
    return matches unless AppFocus.clubs_primary?

    overlay_club_live_scores(matches, include_live: include_live, refresh_cap: refresh_cap)
  rescue => e
    Rails.logger.error("[ApiMatchNormalizer] refresh_club_fixtures: #{e.message}")
    matches
  end

  def overlay_club_live_scores(matches, include_live: true, refresh_cap: FIXTURE_REFRESH_CAP)
    client      = LiveScoresClient.new
    live_by_ext = if include_live
      client.live_matches.index_by { |m| m[:external_id].to_s }
    else
      {}
    end
    refreshes = 0
    deadline  = Process.clock_gettime(Process::CLOCK_MONOTONIC) + REFRESH_TIME_BUDGET_SEC

    matches.map do |m|
      live  = live_by_ext[m[:external_id]&.to_s]
      fresh = live
      if !fresh && needs_fixture_refresh?(m) && refreshes < refresh_cap
        if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline
          next m
        end

        fresh = client.fixture_status(m[:external_id])
        refreshes += 1 if fresh
      end
      next m unless fresh

      merge_fresh_fixture(m, fresh)
    end
  rescue => e
    Rails.logger.error("[ApiMatchNormalizer] overlay_club_live_scores: #{e.message}")
    matches
  end

  def needs_fixture_refresh?(m)
    return false if m[:external_id].blank?

    status = m[:status].to_s
    return true if status == "live"
    return true if status == "finished" && (fixture_home_score(m).nil? || fixture_away_score(m).nil?)

    if status == "scheduled"
      begin
        kickoff = Time.parse(m[:kickoff_at].to_s)
        return kickoff < Time.current
      rescue ArgumentError, TypeError
        return false
      end
    end

    false
  end

  def fixture_home_score(m)
    return m[:home_score] unless m[:home_score].nil?

    m.dig(:home, :score)
  end

  def fixture_away_score(m)
    return m[:away_score] unless m[:away_score].nil?

    m.dig(:away, :score)
  end

  def merge_fresh_fixture(m, fresh)
    finished   = fresh[:status].to_s == "finished"
    home_score = fresh.dig(:home, :score)
    away_score = fresh.dig(:away, :score)
    home_pen   = fresh.dig(:home, :pen_score)
    away_pen   = fresh.dig(:away, :pen_score)

    out = m.merge(
      status:         fresh[:status],
      minute:         finished ? nil : fresh[:minute],
      minute_extra:   finished ? nil : fresh[:minute_extra],
      home_score:     home_score,
      away_score:     away_score,
      home_pen_score: home_pen,
      away_pen_score: away_pen
    )

    if m[:home].is_a?(Hash)
      out[:home] = m[:home].merge(score: home_score, pen_score: home_pen)
      out[:away] = m[:away].merge(score: away_score, pen_score: away_pen)
    end

    if m[:home_team].is_a?(Hash)
      out[:home_team] = m[:home_team]
      out[:away_team] = m[:away_team]
    end

    out
  end
end
