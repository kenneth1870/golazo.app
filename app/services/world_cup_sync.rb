class WorldCupSync
  # API-Football v3 league/season IDs (api-sports.io).
  # FIFA World Cup league_id = 1 on API-Football v3.
  WC_LEAGUE_ID = (ENV["WC_LEAGUE_ID"] || 1).to_i
  WC_SEASON_ID = (ENV["WC_SEASON_ID"] || 2026).to_i

  # football-data.org uses "URY" for Uruguay; we store "URU"
  TLA_OVERRIDES = { "URY" => "URU" }.freeze

  def initialize(competition_code: "WC")
    @api  = LiveScoresClient.new
    @code = competition_code
    @log  = Rails.logger
  end

  # Sync all live matches across all leagues, updating DB records matched by team name
  def sync_live
    # Skip the API call when no WC matches are live or kicking off within 2 hours.
    # Saves API quota during the ~23 hours/day with no active WC matches.
    unless wc_matches_active?
      log("No WC matches live or imminent — skipping live API call")
      return
    end

    matches = @api.live_matches
    updated = 0

    if matches.any?
      log("Live: #{matches.length} matches")
      matches.each { |raw| updated += 1 if sync_match_from_live(raw) }
      log("Updated #{updated} matches")
    end

    # Detect WC matches that were live but are no longer in the feed — they just finished
    check_wc_matches_just_finished(matches)
  end

  # If any DB-live WC match is missing from the current live feed, it just ended.
  # Clear the today-cache and schedule an immediate today-sync so the match gets
  # marked "finished" and standings are recalculated within the next few seconds.
  def check_wc_matches_just_finished(live_matches)
    wc = Competition.find_by(code: "WC")
    return unless wc

    db_live = Match.where(status: "live", competition: wc)
    return unless db_live.exists?

    live_external_ids = live_matches.filter_map { |m| m[:external_id]&.to_s }
    just_finished = db_live.reject { |m| live_external_ids.include?(m.external_id.to_s) }
    return if just_finished.empty?

    log("#{just_finished.count} WC match(es) just finished — busting cache and scheduling sync")

    # Bust cached fixture lists for today and the next day (early-UTC matches
    # like 02:00 UTC are stored under tomorrow's date key in the API cache).
    [ Date.today, Date.today + 1 ].each do |d|
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
    end

    SyncTodayMatchesJob.perform_later
  end

  # Sync today's matches (scheduled + live + finished today).
  # Also syncs early-UTC matches on the next calendar day (kicks before 07:00 UTC)
  # so that evening fixtures in the Americas aren't missed (e.g. 02:00 UTC June 12
  # = 8 PM June 11 in Mexico City).
  def sync_today
    today_matches = @api.matches_for_date(Date.today)

    next_day_early = @api.matches_for_date(Date.today + 1).select do |m|
      t = Time.parse(m[:kickoff_at].to_s) rescue nil
      t && t.utc.hour < 7
    end

    seen = Set.new(today_matches.map { |m| m[:external_id] })
    matches = today_matches + next_day_early.reject { |m| seen.include?(m[:external_id]) }

    return log("No matches today") if matches.empty?

    log("Today: #{matches.length} matches (#{next_day_early.length} early next-day)")
    updated = 0
    matches.each { |m| updated += 1 if sync_match_from_normalized(m) }
    log("Updated #{updated} matches")
  end

  # Sync standings for the WC competition.
  # Tries the external API first; falls back to computing from DB results.
  def sync_standings(competition = nil)
    competition ||= Competition.find_by!(code: @code)

    groups = @api.league_standings(WC_LEAGUE_ID, WC_SEASON_ID)
    if groups.empty?
      log("No standings from API — recalculating from DB results")
      recalculate_standings_from_results(competition)
      return
    end

    log("Standings: #{groups.length} entries")
    groups.each { |entry| upsert_standing(entry, competition) }
  end

  # Legacy full sync — teams and fixtures come from DB seeds for WC 2026.
  # Only live/today sync and standings are updated from the API.
  def sync_all
    log("Sync all: #{@code} (standings + today)")
    competition = Competition.find_by(code: @code)
    unless competition
      log("Competition #{@code} not found in DB — run seeds first")
      return
    end
    sync_standings(competition)
    sync_today
    log("Done")
  end

  # Sync all WC 2026 fixture IDs (and team logos) from API-Football v3.
  # This replaces the old football-data.org sync: once external_ids are API-Football
  # fixture IDs, match_detail_controller can call the API directly to get lineups,
  # events, and stats without any ID-namespace translation.
  #
  # Run once (or whenever fixtures are added/rescheduled):
  #   bin/rails runner "WorldCupSync.new.sync_external_ids_from_api_football"
  def sync_external_ids_from_api_football
    competition = Competition.find_by!(code: @code)
    data = @api.send(:get, "fixtures", league: WC_LEAGUE_ID, season: WC_SEASON_ID)
    fixtures = data.dig("response") || []
    raise "No fixtures returned from API-Football (check WC_LEAGUE_ID/WC_SEASON_ID env vars)" if fixtures.empty?

    log("API-Football returned #{fixtures.size} WC fixtures")
    updated_matches = 0
    updated_teams   = 0

    fixtures.each do |fx|
      fixture_id = fx.dig("fixture", "id")
      next unless fixture_id

      home_api = fx.dig("teams", "home", "name").to_s
      away_api = fx.dig("teams", "away", "name").to_s
      home_logo = fx.dig("teams", "home", "logo").to_s.presence
      away_logo = fx.dig("teams", "away", "logo").to_s.presence

      home_team = find_team_by_api_name(home_api)
      away_team = find_team_by_api_name(away_api)

      # Update team logos from API-Football
      if home_team && home_logo && home_team.flag_url != home_logo
        home_team.update_column(:flag_url, home_logo)
        updated_teams += 1
      end
      if away_team && away_logo && away_team.flag_url != away_logo
        away_team.update_column(:flag_url, away_logo)
        updated_teams += 1
      end

      next unless home_team && away_team

      match = Match.find_by(home_team: home_team, away_team: away_team, competition: competition)
      unless match
        # For knockout rounds, slots may not be resolved yet — skip
        next
      end

      if match.external_id != fixture_id
        match.update_column(:external_id, fixture_id)
        updated_matches += 1
        log("  #{home_api} vs #{away_api} → fixture_id #{fixture_id}")
      end
    end

    log("Done: #{updated_matches} matches updated, #{updated_teams} team logos updated")
  rescue => e
    log("sync_external_ids_from_api_football error: #{e.message}")
    raise
  end

  # Legacy: kept for reference but superseded by sync_external_ids_from_api_football.
  # football-data.org IDs are in a different namespace from API-Football — do not use.
  # @deprecated
  def sync_from_football_data
    api_key = ENV["FOOTBALL_DATA_API_KEY"]
    raise "FOOTBALL_DATA_API_KEY not set" if api_key.blank?

    base    = "https://api.football-data.org/v4"
    headers = { "X-Auth-Token" => api_key }

    # ── Teams ──
    teams_resp = JSON.parse(URI.open("#{base}/competitions/WC/teams?season=2026", headers).read)
    fd_teams   = teams_resp["teams"] || []

    updated_teams = 0
    fd_teams.each do |ft|
      tla  = TLA_OVERRIDES[ft["tla"]] || ft["tla"]
      team = Team.find_by(code: tla)
      unless team
        # fallback: match by name
        team = Team.find_by("LOWER(name) = ?", ft["name"].downcase)
      end
      next unless team

      team.external_id = ft["id"]
      team.flag_url    = ft["crest"] if ft["crest"].present?
      team.save! if team.changed?
      updated_teams += 1
    end
    log("Teams updated: #{updated_teams}/#{fd_teams.length}")

    # ── Matches ──
    matches_resp = JSON.parse(URI.open("#{base}/competitions/WC/matches?season=2026", headers).read)
    fd_matches   = matches_resp["matches"] || []

    competition = Competition.find_by!(code: "WC")
    updated_matches = 0

    fd_matches.each do |fm|
      home_tla = fm.dig("homeTeam", "tla")
      away_tla = fm.dig("awayTeam", "tla")
      kickoff  = fm["utcDate"]
      next unless home_tla && away_tla && kickoff

      home_code = TLA_OVERRIDES[home_tla] || home_tla
      away_code = TLA_OVERRIDES[away_tla] || away_tla
      home_team = Team.find_by(code: home_code)
      away_team = Team.find_by(code: away_code)
      next unless home_team && away_team

      match = Match.find_by(
        home_team: home_team,
        away_team: away_team,
        competition: competition
      )
      next unless match

      match.external_id = fm["id"]
      match.save! if match.changed?
      updated_matches += 1
    end
    log("Matches updated: #{updated_matches}/#{fd_matches.length}")
  rescue => e
    log("sync_from_football_data error: #{e.message}")
    raise
  end

  # Recalculate WC group standings purely from finished matches in the DB,
  # applying FIFA tiebreakers (see WorldCupStandings). Always-accurate fallback
  # independent of the external standings API.
  def recalculate_standings_from_results(competition = nil)
    competition ||= Competition.find_by!(code: @code)
    calc = WorldCupStandings.new(competition)

    calc.groups.each do |group_letter, ranked|
      ranked.each_with_index do |s, idx|
        Standing.find_or_initialize_by(team: s.team, competition: competition).tap do |st|
          st.group_name    = group_letter
          st.rank          = idx + 1
          st.played        = s.played
          st.won           = s.won
          st.drawn         = s.drawn
          st.lost          = s.lost
          st.goals_for     = s.goals_for
          st.goals_against = s.goals_against
          st.points        = s.points
          st.save!
        end
      end
    end

    log("Standings recalculated for #{calc.groups.size} groups")
  rescue => e
    Rails.logger.error("[WorldCupSync] recalculate_standings_from_results failed: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
    raise
  end

  # Canonical WC 2026 group fixtures, kept as data (not baked into a migration)
  # so the schedule can be re-imported idempotently when it changes.
  def self.group_fixtures
    YAML.load_file(Rails.root.join("db/world_cup_group_fixtures.yml"))
  end

  # Idempotently upserts the group-stage schedule. Preserves any status/scores
  # already recorded for a fixture. Returns the number of fixtures imported.
  def import_group_fixtures(fixtures = self.class.group_fixtures)
    competition = Competition.find_by!(code: @code)
    imported = 0

    fixtures.each do |f|
      home = Team.find_by(code: f["home"])
      away = Team.find_by(code: f["away"])
      next unless home && away

      match = Match.find_or_initialize_by(home_team: home, away_team: away, competition: competition)
      match.kickoff_at  = f["kickoff"]
      match.venue       = f["venue"]
      match.group_stage = f["group"]
      match.round       = f["round"]
      match.status    ||= "scheduled"
      match.save!
      imported += 1
    end

    log("Imported #{imported}/#{fixtures.size} group fixtures")
    imported
  end

  private

  # True if any WC match is currently live OR kicks off within the next 2 hours.
  # Used to gate sync_live so we don't burn API quota during the ~23 h/day with
  # no active WC action.
  def wc_matches_active?
    wc = Competition.find_by(code: "WC")
    return false unless wc

    Match.where(competition: wc, status: "live").exists? ||
      Match.where(competition: wc, status: "scheduled")
           .where(kickoff_at: Time.current..2.hours.from_now)
           .exists?
  end

  # Updates a DB match from a normalized match hash (from live_matches).
  # Receives the same shape as sync_match_from_normalized.
  def sync_match_from_live(raw)
    home_name    = raw.dig(:home, :name)
    away_name    = raw.dig(:away, :name)
    return false unless home_name && away_name

    home_score   = raw.dig(:home, :score)
    away_score   = raw.dig(:away, :score)
    minute       = raw[:minute]
    status_short = raw[:status_short]

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    match.lock!

    # API sometimes returns FT/AET/PEN while the fixture is still briefly in the
    # live feed. Treat any finished status_short as a finalisation event so the
    # match doesn't stay stuck as "live" waiting for check_wc_matches_just_finished.
    finished_shorts = %w[FT AET PEN AWD WO]
    if finished_shorts.include?(status_short)
      was_live = match.status == "live"
      match.update!(status: "finished", home_score: home_score, away_score: away_score)
      if was_live && match.competition&.code == "WC"
        fire_notification(match, "fulltime",
          home_score: home_score.to_i, away_score: away_score.to_i)
        RecalculateStandingsJob.perform_later
      end
      if match.external_id.present? && home_score && away_score
        ScorePrediction.grade!(
          match_external_id: match.external_id.to_s,
          home_score: home_score.to_i, away_score: away_score.to_i
        )
      end
      GenerateMatchSummaryJob.set(wait: 5.minutes).perform_later(match_id: match.id) if match.id.present?
      return true
    end

    # Kickoff: match transitions from scheduled → live feed
    if match.status == "scheduled"
      match.update!(status: "live", home_score: home_score, away_score: away_score)
      broadcast_score(match, minute, event_type: "kickoff")
      return true
    end

    # Half-time: status_short == "HT" — notify once per match
    if status_short == "HT" && !Rails.cache.read("ht_notified_#{match.id}")
      Rails.cache.write("ht_notified_#{match.id}", true, expires_in: 3.hours)
      fire_notification(match, "halftime", minute: minute,
        home_score: match.home_score.to_i, away_score: match.away_score.to_i)
    end

    return false if home_score == match.home_score && away_score == match.away_score

    # Only push a "goal" alert when the total score actually increased — a
    # downward correction or provider flap shouldn't fire a GOAL notification.
    scored = (home_score.to_i + away_score.to_i) > (match.home_score.to_i + match.away_score.to_i)

    match.update!(status: "live", home_score: home_score, away_score: away_score)
    broadcast_score(match, minute, notify: scored)
    true
  rescue => e
    log("Live sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  # Updates a DB match from a normalized match hash (from matches_for_date)
  def sync_match_from_normalized(m)
    home_name = m.dig(:home, :name)
    away_name = m.dig(:away, :name)
    return false unless home_name && away_name

    status     = m[:status]
    home_score = m.dig(:home, :score)
    away_score = m.dig(:away, :score)

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    was_live = match.status == "live"

    attrs = { status: status }
    attrs[:home_score] = home_score unless status == "scheduled"
    attrs[:away_score] = away_score unless status == "scheduled"

    match.update!(attrs)
    broadcast_score(match, m[:minute], notify: false) if status == "live"

    # Full-time: WC match just finished — notify subscribers
    if status == "finished" && was_live && match.competition&.code == "WC"
      fire_notification(match, "fulltime",
        home_score: home_score.to_i, away_score: away_score.to_i)
    end

    # Recalculate group standings after a WC match finishes
    if status == "finished" && match.competition&.code == "WC"
      RecalculateStandingsJob.perform_later
    end

    # Grade score predictions after match finishes
    if status == "finished" && match.external_id.present? && home_score && away_score
      ScorePrediction.grade!(
        match_external_id: match.external_id.to_s,
        home_score: home_score.to_i,
        away_score: away_score.to_i
      )
    end

    # Pre-warm AI match summary cache after match finishes (5 min delay)
    if status == "finished" && match.id.present?
      GenerateMatchSummaryJob.set(wait: 5.minutes).perform_later(match_id: match.id)
    end

    true
  rescue => e
    log("Today sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  def upsert_standing(entry, competition)
    # API-Football v3 standing entry shape:
    # { rank:, group:, points:, team: {name:}, all: {played:, win:, draw:, lose:, goals: {for:, against:}} }
    team_name = entry.dig("team", "name")
    return unless team_name

    team = Team.where("LOWER(name) = ?", team_name.downcase).first
    # Fuzzy fallback: only match if ALL words in the API name appear in the DB name,
    # which prevents "United" matching "United Arab Emirates" when we want "United States".
    unless team
      words = team_name.downcase.split
      team = Team.where(words.map { "LOWER(name) LIKE ?" }.join(" AND "),
                        *words.map { |w| "%#{w}%" }).first
    end
    return unless team

    all = entry["all"] || {}
    goals = all["goals"] || {}

    Standing.find_or_initialize_by(team: team, competition: competition).tap do |s|
      s.group_name    = entry["group"]
      s.rank          = entry["rank"]
      s.played        = all["played"]
      s.won           = all["win"]
      s.drawn         = all["draw"]
      s.lost          = all["lose"]
      s.goals_for     = goals["for"]
      s.goals_against = goals["against"]
      s.points        = entry["points"]
      s.save!
    end
  rescue => e
    Rails.logger.error("[WorldCupSync] upsert_standing failed for #{team_name}: #{e.message}")
  end

  # API-Football v3 uses different spellings for some WC nations.
  # Map API name → DB canonical name so sync survives naming mismatches.
  TEAM_ALIASES = {
    # South Korea
    "korea republic"               => "south korea",
    "republic of korea"            => "south korea",
    # Ivory Coast
    "côte d'ivoire"                => "ivory coast",
    "cote d'ivoire"                => "ivory coast",
    "cote divoire"                 => "ivory coast",
    # United States
    "usa"                          => "united states",
    "united states of america"     => "united states",
    # Bosnia
    "bosnia and herzegovina"       => "bosnia & herz.",
    "bosnia & herzegovina"         => "bosnia & herz.",
    "bosnia-herzegovina"           => "bosnia & herz.",
    # DR Congo
    "congo dr"                     => "dr congo",
    "democratic republic of congo" => "dr congo",
    "dr. congo"                    => "dr congo",
    # Czechia
    "czech republic"               => "czechia",
    # Cape Verde
    "cabo verde"                   => "cape verde",
    # Curacao
    "curaçao"                      => "curacao",
    "curacao"                      => "curacao",
    # Turkey
    "türkiye"                      => "turkey",
    "turkiye"                      => "turkey",
    # Iran
    "ir iran"                      => "iran",
    "islamic republic of iran"     => "iran",
    # Saudi Arabia
    "ksa"                          => "saudi arabia",
    # Algeria
    "algeria"                      => "algeria",
    "algérie"                      => "algeria"
  }.freeze

  def normalize_team_name(name)
    TEAM_ALIASES[name.downcase] || name.downcase
  end

  # Finds a Team by API-Football name using TEAM_ALIASES + fuzzy token match.
  def find_team_by_api_name(api_name)
    return nil if api_name.blank?
    canonical = normalize_team_name(api_name)
    team = Team.where("LOWER(name) = ?", canonical).first
    return team if team

    # Token match: all meaningful words must appear in the DB name
    tokens = api_name.downcase.split(/[\s\-\.]+/).select { |t| t.length > 2 }
    return nil if tokens.empty?
    Team.where(tokens.map { "LOWER(name) LIKE ?" }.join(" AND "), *tokens.map { |t| "%#{t}%" }).first
  end

  # normalize_team_name lowercases and applies TEAM_ALIASES; when a name has no
  # alias it just lowercases. A single normalized query therefore subsumes the
  # old "raw downcased" fallback (which could only ever match alias-less names
  # the normalized query already covered).
  def find_match_by_teams(home_name, away_name)
    Match
      .joins("INNER JOIN teams home_teams ON home_teams.id = matches.home_team_id")
      .joins("INNER JOIN teams away_teams ON away_teams.id = matches.away_team_id")
      .where(status: %w[scheduled live])
      .find_by(
        "LOWER(home_teams.name) = ? AND LOWER(away_teams.name) = ?",
        normalize_team_name(home_name), normalize_team_name(away_name),
      )
  rescue => e
    log("Match lookup error: #{e.message}")
    nil
  end

  def broadcast_score(match, minute = nil, event_type: "goal", notify: true)
    payload = {
      type:       "score_update",
      home_score: match.home_score,
      away_score: match.away_score,
      status:     match.status,
      minute:     minute
    }
    ActionCable.server.broadcast("match_#{match.id}", payload)

    if match.external_id
      ActionCable.server.broadcast("external_match_#{match.external_id}", payload.merge(type: "match_update"))
    end

    return unless notify
    fire_notification(match, event_type, minute: minute,
      home_score: match.home_score.to_i, away_score: match.away_score.to_i)
  end

  def fire_notification(match, event_type, home_score: nil, away_score: nil, minute: nil)
    MatchEventNotificationJob.perform_later(
      event_type: event_type,
      match_id:   match.id,
      home_name:  match.home_team&.name.to_s,
      away_name:  match.away_team&.name.to_s,
      home_score: home_score,
      away_score: away_score,
      minute:     minute,
      match_url:  "/matches/#{match.external_id || "db-#{match.id}"}"
    )
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
