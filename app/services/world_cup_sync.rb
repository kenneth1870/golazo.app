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

  # A DB-live WC match missing from the live feed MIGHT have ended — but absence
  # is NOT a reliable end signal. The feed can drop a match for a cycle mid-game,
  # between regular and extra time, etc. Marking it finished here fired full-time
  # alerts ~10 min before the real end (the feed flapping around the 80th minute),
  # and it couldn't know whether extra time was still coming.
  #
  # So we no longer finish/notify on absence. Instead we bust the date caches and
  # trigger an authoritative date-feed re-sync. sync_match_from_normalized then
  # marks the match finished and fires full-time ONLY when the API reports a
  # terminal status (FT/AET/PEN) — i.e. just after the game truly ends, extra
  # time and penalties included. If it's only a flap, the date feed still says
  # "live" and nothing happens.
  def check_wc_matches_just_finished(live_matches)
    wc = Competition.find_by(code: "WC")
    return unless wc

    # An empty feed almost always means a transient API error (live_matches
    # rescues to []), not that every live match vanished — ignore it.
    return if live_matches.blank?

    db_live = Match.where(status: "live", competition: wc)
    return unless db_live.exists?

    live_external_ids = live_matches.filter_map { |m| m[:external_id]&.to_s }
    missing = db_live.reject { |m| live_external_ids.include?(m.external_id.to_s) }
    return if missing.empty?

    # Debounce: at most one verification sync per minute, so a persistent feed
    # gap (or the fast 30s live loop) can't hammer the date endpoint.
    return unless Rails.cache.write("verify_finish_sync_recent", true, expires_in: 60.seconds, unless_exist: true)

    log("#{missing.count} WC match(es) missing from live feed — verifying via date sync")

    # Bust cached fixture lists for today and the next day (early-UTC matches
    # like 02:00 UTC are stored under tomorrow's date key in the API cache) so
    # the verification re-sync reads fresh, authoritative status.
    [ Time.current.utc.to_date, Time.current.utc.to_date + 1 ].each do |d|
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
      Rails.cache.delete("today_api_#{d.iso8601}")
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

    sync_stale_past_matches(seen)
  end

  # Catch-up: re-sync any DB matches still scheduled/live whose kickoff was
  # long enough ago that they should be finished. Prevents matches from getting
  # stuck in 'scheduled' if the server was down or the sync window was missed.
  # Also re-syncs matches that finished within the last 4 hours: if the live
  # feed finalized a match early (e.g. at 0-0 before a late goal), the date
  # endpoint will return the authoritative final score and overwrite it.
  def sync_stale_past_matches(already_synced_ids = Set.new)
    # No external_id filter — seeded matches start without one and would be
    # permanently skipped. sync_match_from_normalized sets external_id on first
    # successful lookup, so they self-heal after the first stale re-sync.
    stale = Match.where(status: %w[scheduled live])
                 .where(kickoff_at: 7.days.ago..115.minutes.ago)

    recent_finished = Match.where(status: "finished")
                           .where(kickoff_at: 4.hours.ago..Time.current)

    stale_count    = stale.count
    finished_count = recent_finished.count
    return if stale_count.zero? && finished_count.zero?

    stale_dates = Match.where(id: stale).or(Match.where(id: recent_finished))
                       .pluck(Arel.sql("DATE(kickoff_at AT TIME ZONE 'UTC')"))
                       .map { |d| d.is_a?(Date) ? d : Date.parse(d.to_s) }
                       .uniq

    log("Catch-up: #{stale_count} stale + #{finished_count} recent-finished match(es) across #{stale_dates.length} date(s)")

    stale_dates.each do |d|
      # Bust the past-date cache before re-fetching. Past dates are cached for
      # 24 h, so if the cache was primed while the match was still "2H" the
      # re-sync would write "live" back to the DB and leave standings broken.
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
      Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
      past_matches = @api.matches_for_date(d)
      past_matches
        .reject { |m| already_synced_ids.include?(m[:external_id]) }
        .each   { |m| sync_match_from_normalized(m) }
    end
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

  # Re-sync ALL finished WC match dates from the API, regardless of age.
  # Corrects any scores that were finalized incorrectly (e.g. early-UTC matches
  # that fell outside the 4h stale-match window before the bug was fixed).
  # Safe to call repeatedly — sync_match_from_normalized is idempotent.
  # Full heal: re-fetches every WC match date from the API (busting all date
  # caches first), writes correct scores/statuses bypassing the flap guard,
  # and broadcasts corrections to connected clients. Safe to run at any time.
  def resync_all_wc_match_dates
    wc = Competition.find_by(code: @code)
    return log("Competition #{@code} not found") unless wc

    # All dates with ANY match (not just finished) plus today and tomorrow.
    db_dates = Match.where(competition: wc)
                    .pluck(:kickoff_at)
                    .map { |t| t.utc.to_date }
                    .uniq

    dates = (db_dates + [ Date.today, Date.today + 1 ]).uniq.sort
    log("heal_all: #{dates.size} date(s) — #{dates.join(', ')}")

    fixed = 0
    dates.each do |d|
      # Bust every known cache variant for this date so we never read stale data.
      %W[
        live_scores_date_v15_#{d.iso8601}_utc
        live_scores_date_v15_#{d.iso8601}_
        today_api_#{d.iso8601}
      ].each { |k| Rails.cache.delete(k) }

      api_matches = @api.matches_for_date(d)
      log("  #{d}: #{api_matches.size} API matches")
      api_matches.each do |m|
        changed = sync_match_from_normalized(m, force: true)
        fixed += 1 if changed
      end
    end

    # Bust scorer/assists/cards caches so the next request reflects all changes.
    bust_scorers_cache
    # Also bust per-fixture event caches so WorldCupScorers re-aggregates freshly.
    wc = Competition.find_by(code: @code)
    if wc
      Match.where(competition: wc, status: "finished").where.not(external_id: nil)
           .pluck(:external_id).each do |fid|
        Rails.cache.delete("wc_fixture_events_v1_#{fid}")
        Rails.cache.delete("live_scores_detail_v5_#{fid}")
      end
    end

    log("heal_all complete — #{fixed} match(es) updated")
    fixed
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

  # Public wrapper so jobs can decide whether to run the sub-minute live loop
  # without burning quota when there's no active WC action.
  def self.live_window_active?
    new.send(:wc_matches_active?)
  end

  # Narrow check: is a WC match ACTUALLY being played right now? Used to gate the
  # sub-minute fast-poll loop so the extra API calls only happen during the ~2 h a
  # match is live — not during the broad pre-/post-match window.
  def self.live_now?
    wc = Competition.find_by(code: "WC")
    wc && Match.where(competition: wc, status: "live").exists?
  end

  private

  # True if any WC match is currently live OR kicks off within the next 2 hours.
  # Used to gate sync_live so we don't burn API quota during the ~23 h/day with
  # no active WC action.
  def wc_matches_active?
    # Cache for 90 s so the per-minute sync job doesn't run 3 DB queries on
    # every tick between tournaments. During live play the cache is busted
    # immediately when a match transitions to/from live (see sync_match_from_live).
    Rails.cache.fetch("wc_matches_active_v1", expires_in: 90.seconds, race_condition_ttl: 10.seconds) do
      wc = Competition.find_by(code: "WC")
      next false unless wc

      # Active = currently live, OR kicking off within 2 hours, OR already
      # kicked off within the last 3 hours but still 'scheduled' in DB (sync lag).
      # The 3-hour lookback prevents a stuck 'scheduled' status from silencing
      # the live-sync gate — without it, goal/fulltime notifications are never sent.
      next true if Match.where(competition: wc, status: "live").exists?
      next true if Match.where(competition: wc, status: "scheduled")
                          .where(kickoff_at: 3.hours.ago..2.hours.from_now)
                          .exists?

      # Keep the 1-min live sync running for matches marked 'finished' whose kickoff
      # was recent enough that they could still be in progress (≤ 2.5 h, covering
      # extra time + penalties). Without this, a match wrongly flipped to 'finished'
      # silences the live gate, so goals only get picked up by the 10-min today-sync
      # (a 10-minute notification delay) and the live-path self-heal never runs.
      Match.where(competition: wc, status: "finished")
           .where(kickoff_at: 2.5.hours.ago..Time.current)
           .exists?
    end
  end

  # Updates a DB match from a normalized match hash (from live_matches).
  # Receives the same shape as sync_match_from_normalized.
  def sync_match_from_live(raw)
    home_name    = raw.dig(:home, :name)
    away_name    = raw.dig(:away, :name)
    return false unless home_name && away_name

    home_score    = raw.dig(:home, :score)
    away_score    = raw.dig(:away, :score)
    minute        = raw[:minute]
    minute_extra  = raw[:minute_extra]
    status_short  = raw[:status_short]

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    match.lock!

    # API sometimes returns FT/AET/PEN while the fixture is still briefly in the
    # live feed. Treat any finished status_short as a finalisation event so the
    # match doesn't stay stuck as "live" waiting for check_wc_matches_just_finished.
    finished_shorts = %w[FT AET PEN AWD WO]
    if finished_shorts.include?(status_short)
      was_not_finished = match.status != "finished"
      finish_attrs = { status: "finished", home_score: home_score, away_score: away_score }
      if match.group_stage.blank?
        group = match.home_team&.group.presence || match.away_team&.group.presence
        finish_attrs[:group_stage] = group if group
      end
      match.update!(finish_attrs)
      if was_not_finished && match.competition&.code == "WC"
        dedup_key = "fulltime_notified_#{match.id}"
        unless Rails.cache.read(dedup_key)
          # Only mark as notified if the alert actually went out (the early-FT
          # guard in fire_notification may suppress it), so a real full-time can
          # still fire later.
          if fire_notification(match, "fulltime",
            home_score: home_score.to_i, away_score: away_score.to_i)
            Rails.cache.write(dedup_key, true, expires_in: 24.hours)
          end
        end
        RecalculateStandingsJob.perform_later
        bust_scorers_cache(match)
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

    # Self-heal: the feed lists this match with a live (non-finished) status
    # but our DB says "finished" — it may have been wrongly finished by a feed
    # flap. Only revert when the elapsed minute is < 85: at 85+ the match is
    # near or past full time and the "2H" status is almost certainly API lag
    # (the feed takes 1-3 min to flip from "2H" to "FT" after the whistle).
    # Reverting at 90' would leave the match stuck as "live" for minutes after
    # the game ends. Deliberately keep the full-time dedup key so a flapping
    # feed near the end can't fire a second "Final" alert.
    if match.status == "finished"
      elapsed = minute.to_i
      if elapsed < 85
        match.update!(status: "live", home_score: home_score, away_score: away_score)
        log("Reverted falsely-finished #{match.id} (#{home_name} vs #{away_name}) back to live (#{elapsed}')")
        broadcast_score(match, minute, minute_extra: minute_extra, notify: false)
      else
        log("Ignoring self-heal for #{match.id} (#{home_name} vs #{away_name}) at #{elapsed}' — API lag after FT")
      end
      return true
    end

    # Kickoff: match transitions from scheduled → live feed
    if match.status == "scheduled"
      match.update!(status: "live", home_score: home_score, away_score: away_score)
      # Bust the active-match gate cache so the live sync loop starts immediately
      # rather than waiting up to 90 s for the TTL to expire.
      Rails.cache.delete("wc_matches_active_v1")
      # Bust the today feed cache so the live match appears immediately on the
      # Hoy page without waiting for the 90s outer cache or 10min inner cache.
      [ Date.today, Date.today + 1 ].each do |d|
        Rails.cache.delete("today_api_#{d.iso8601}")
        Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_utc")
        Rails.cache.delete("live_scores_date_v15_#{d.iso8601}_")
      end
      broadcast_score(match, minute, minute_extra: minute_extra, notify: false)
      return true
    end

    score_unchanged = home_score == match.home_score && away_score == match.away_score
    minute_unchanged = minute.to_i == match.minute.to_i

    # Nothing changed — skip entirely to avoid unnecessary DB writes and broadcasts.
    return false if score_unchanged && minute_unchanged

    old_total = match.home_score.to_i + match.away_score.to_i
    new_total = home_score.to_i + away_score.to_i

    # Anti-spam flap guard: ignore a downward total during live play. Providers
    # occasionally dip a score for one cycle and restore it the next; persisting
    # the dip would make the recovery look like a fresh goal and fire a duplicate
    # alert. Keep the higher score live; the authoritative final score is written
    # by the FT/AET/PEN path when the match actually ends.
    return false if new_total < old_total

    # Only push a "goal" alert when the total score actually increased.
    # Suppress if the API has flagged a VAR disallowed goal — the score bump
    # may be a transient feed artefact before the reversal comes through.
    scored = new_total > old_total && !raw[:var_disallowed]

    # Skip if the match_detail_controller already fired the notification when it
    # patched the DB score (atomic write: only the first writer fires).
    if scored
      dedup = "goal_notified_#{match.id}_#{home_score}_#{away_score}"
      scored = Rails.cache.write(dedup, true, expires_in: 5.minutes, unless_exist: true)
    end

    match.update!(status: "live", home_score: home_score, away_score: away_score, minute: minute)
    broadcast_score(match, minute, minute_extra: minute_extra, notify: scored,
      scorer: scored ? raw[:last_scorer] : nil)
    true
  rescue => e
    log("Live sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  # Updates a DB match from a normalized match hash (from matches_for_date).
  # force: true bypasses the flap guard — used by the heal path to correct VAR
  # score rollbacks that the guard would normally block during live play.
  def sync_match_from_normalized(m, force: false)
    home_name = m.dig(:home, :name)
    away_name = m.dig(:away, :name)
    return false unless home_name && away_name

    status     = m[:status]
    home_score = m.dig(:home, :score)
    away_score = m.dig(:away, :score)

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    was_live     = match.status == "live"
    was_finished = match.status == "finished"
    old_home     = match.home_score.to_i
    old_away     = match.away_score.to_i

    # Don't downgrade a finished match back to live — the date endpoint lags
    # 1-3 minutes after the final whistle and still returns "2H". Trusting the
    # date feed here would unfinish matches and wipe points from the standings.
    return false if was_finished && status == "live" && !force

    # Anti-spam flap guard: during live play, don't persist a downward total —
    # a one-cycle dip + recovery would otherwise look like a fresh goal and fire
    # a duplicate alert. The FT path writes the authoritative final score.
    # Bypassed when force: true (heal path) to allow VAR/offside corrections.
    downward_live = !force && status == "live" &&
                    (home_score.to_i + away_score.to_i) < (old_home + old_away)

    api_ext_id = m[:external_id]
    attrs = { status: status }
    unless status == "scheduled" || downward_live
      attrs[:home_score] = home_score unless home_score.nil?
      attrs[:away_score] = away_score unless away_score.nil?
    end
    # Backfill group_stage if missing — covers matches created before fixtures import
    if match.group_stage.nil?
      inferred_group = match.home_team&.group.presence || match.away_team&.group.presence
      attrs[:group_stage] = inferred_group if inferred_group
    end
    # Self-heal: update external_id when the DB has a stale one (e.g. seeded
    # from a different API source) so broadcasts and grade! use the right ID.
    if api_ext_id.present? && match.external_id.to_s != api_ext_id.to_s
      attrs[:external_id] = api_ext_id
    end

    match.update!(attrs)

    if status == "live"
      # Fire a goal notification when the score increases — covers matches that
      # come through the today-sync path rather than the live-feed path (e.g.
      # server restart mid-match or match absent from the live API feed).
      scored = match.competition&.code == "WC" &&
               (home_score.to_i + away_score.to_i) > (old_home + old_away)
      broadcast_score(match, m[:minute], notify: scored)
    end

    # Full-time: fire ONLY on the actual transition to finished (the match was
    # NOT already finished in the DB). This is critical: sync_stale_past_matches
    # re-syncs recently-finished matches every 10 min, and without this guard the
    # block would re-enter on every pass and re-notify — spamming "Final" alerts
    # for a match that ended an hour ago. The dedup key is a secondary safety net.
    just_finished = status == "finished" && !was_finished
    if just_finished && match.competition&.code == "WC"
      dedup_key  = "fulltime_notified_#{match.id}"
      claim_key  = "fulltime_notifying_#{match.id}"
      # Atomically claim the notification slot to prevent two concurrent syncs
      # from both firing the full-time push. The claim expires in 30 s so a
      # suppressed notification (early-FT guard) can retry on the next cycle.
      if Rails.cache.write(claim_key, true, expires_in: 30.seconds, unless_exist: true) &&
         !Rails.cache.read(dedup_key)
        # Mark notified only if the alert actually fired (early-FT guard may
        # suppress it), so a genuine full-time can still notify later.
        if fire_notification(match, "fulltime",
          home_score: home_score.to_i, away_score: away_score.to_i)
          Rails.cache.write(dedup_key, true, expires_in: 24.hours)
        else
          Rails.cache.delete(claim_key)
        end
      end
      RecalculateStandingsJob.perform_later
      bust_scorers_cache(match)
      # Bust the per-fixture event cache so WorldCupScorers re-fetches
      # events from the API on the next scorer aggregation — prevents a
      # stale/empty event cache from zeroing out a player's goal tally.
      if match.external_id.present?
        Rails.cache.delete("wc_fixture_events_v1_#{match.external_id}")
        Rails.cache.delete("live_scores_detail_v5_#{match.external_id}")
      end

      # Bust the today-api cache so the next refetch (triggered by the
      # standings-channel broadcast above) sees the finished status, not a
      # stale 90s snapshot that still calls the match "live".
      kickoff_date = match.kickoff_at&.utc&.to_date
      if kickoff_date
        [ kickoff_date, kickoff_date + 1, kickoff_date - 1 ].each do |d|
          Rails.cache.delete("today_api_#{d.iso8601}")
        end
      end

      # Immediately push "finished" to the live-scores channel so the LIVE
      # panel on the home page removes the match without waiting for the 60s poll.
      ActionCable.server.broadcast("live_scores", {
        type:         "live_score_update",
        match_id:     match.id,
        external_id:  match.external_id,
        home_score:   home_score.to_i,
        away_score:   away_score.to_i,
        status:       "finished",
        minute:       nil,
        minute_extra: nil
      })
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

    team = find_team_by_api_name(team_name)
    return unless team

    all = entry["all"] || {}
    goals = all["goals"] || {}

    Standing.find_or_initialize_by(team: team, competition: competition).tap do |s|
      s.group_name    = entry["group"]&.sub(/\AGroup\s+/i, "")
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
    "cape verde islands"           => "cape verde",
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
      # scheduled/live always, plus finished matches within 8 hours of kickoff.
      # 48h covers same-day reschedules and early-UTC matches (e.g. 01:00 UTC)
      # that got wrong scores and need correcting via ResyncAllWcMatchesJob later
      # in the day. The anti-spam guard (just_finished check) prevents duplicate
      # notifications when re-syncing already-finished matches.
      .where(
        "matches.status IN ('scheduled','live') OR " \
        "(matches.status = 'finished' AND matches.kickoff_at > ?)",
        48.hours.ago
      )
      .find_by(
        "LOWER(home_teams.name) = ? AND LOWER(away_teams.name) = ?",
        normalize_team_name(home_name), normalize_team_name(away_name),
      )
  rescue => e
    log("Match lookup error: #{e.message}")
    nil
  end

  def broadcast_score(match, minute = nil, minute_extra: nil, event_type: "goal", notify: true, scorer: nil)
    payload = {
      type:         "score_update",
      home_score:   match.home_score,
      away_score:   match.away_score,
      status:       match.status,
      minute:       minute,
      minute_extra: minute_extra
    }
    ActionCable.server.broadcast("match_#{match.id}", payload)

    if match.external_id
      ActionCable.server.broadcast("external_match_#{match.external_id}", payload.merge(type: "match_update"))
    end

    # Bust the today-api cache so that any safety-net poll immediately after a
    # goal or status change sees fresh data rather than the 90s stale snapshot.
    kickoff_date = match.kickoff_at&.utc&.to_date
    if kickoff_date
      [ kickoff_date, kickoff_date + 1, kickoff_date - 1 ].each do |d|
        Rails.cache.delete("today_api_#{d.iso8601}")
      end
    end

    # Shared stream for list views (Today, Home) — carries enough identity to
    # update the right row without a full re-fetch.
    ActionCable.server.broadcast("live_scores", payload.merge(
      type:         "live_score_update",
      match_id:     match.id,
      external_id:  match.external_id,
      minute_extra: minute_extra
    ))

    return unless notify
    fire_notification(match, event_type, minute: minute,
      home_score: match.home_score.to_i, away_score: match.away_score.to_i,
      scorer: scorer)
  end

  def fire_notification(match, event_type, home_score: nil, away_score: nil, minute: nil, scorer: nil)
    # Defense-in-depth: a full-time alert must never go out before a match could
    # plausibly be over. A 90' match runs ≥ ~100 min after kickoff (45 + half-time
    # + 45 + stoppage); extra time ends even later. So suppress "fulltime" if
    # kickoff was < 100 min ago, regardless of what any feed/heuristic claims —
    # this blocks premature "match ended" pushes from bad data or feed flaps.
    if event_type.to_s == "fulltime" && match.kickoff_at.present? &&
        match.kickoff_at > 100.minutes.ago
      log("Suppressed early fulltime for #{match.id} (#{match.home_team&.name} vs #{match.away_team&.name}) — only #{((Time.current - match.kickoff_at) / 60).round} min since kickoff")
      return false
    end

    if match.kickoff_at.present?
      # Never notify more than 210 min past kickoff — covers 90' + HT + 30' ET
      # + stoppage. Anything later is a stuck sync or manual correction, not a
      # live event. Calendar-date comparisons are intentionally avoided: evening
      # US matches routinely cross midnight UTC while still in the first half,
      # and a date check would falsely suppress in-progress goal notifications.
      if Time.current > match.kickoff_at + 210.minutes
        elapsed = ((Time.current - match.kickoff_at) / 60).round
        log("Suppressed late notification (#{event_type}) for #{match.id} (#{match.home_team&.name} vs #{match.away_team&.name}) — #{elapsed} min since kickoff, outside notification window")
        return false
      end
    end

    log("fire_notification: #{event_type} | #{match.home_team&.name} vs #{match.away_team&.name} | #{home_score}–#{away_score} | scorer=#{scorer.inspect}")
    MatchEventNotificationJob.perform_later(
      event_type: event_type,
      match_id:   match.id,
      home_name:  match.home_team&.name.to_s,
      away_name:  match.away_team&.name.to_s,
      home_score: home_score,
      away_score: away_score,
      minute:     minute,
      scorer:     scorer,
      match_url:  "/matches/#{match.external_id || "db-#{match.id}"}"
    )
    true
  end

  # Bust all top-scorers / assists / cards caches for the WC so that the
  # next request reflects the just-finished match immediately.
  # Also clears the per-fixture event cache so WorldCupScorers.fetch_events
  # gets fresh events for this match (not a stale mid-match snapshot).
  def bust_scorers_cache(match = nil)
    keys = [
      "live_scores_scorers_v2_#{WC_LEAGUE_ID}_#{WC_SEASON_ID}",
      "live_scores_assists_v1_#{WC_LEAGUE_ID}_#{WC_SEASON_ID}",
      "live_scores_yellowcards_v1_#{WC_LEAGUE_ID}_#{WC_SEASON_ID}",
      "live_scores_redcards_v1_#{WC_LEAGUE_ID}_#{WC_SEASON_ID}",
      "wc_scorers_v1_WC",
      "wc_assists_v1_WC",
      "wc_yellow_cards_v1_WC",
      "wc_red_cards_v1_WC"
    ]
    if match&.external_id.present?
      keys << "wc_fixture_events_v1_#{match.external_id}"
      keys << "live_scores_detail_v5_#{match.external_id}"
    end
    keys.each { |k| Rails.cache.delete(k) }
    log("Busted scorers/assists/cards caches after match finish")
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
