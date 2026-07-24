class ClubLiveSync
  # Polls the live API feed for featured club leagues and fires scoped push
  # notifications on score changes and full-time. WC matches are handled by
  # WorldCupSync against the DB; this service covers API-only club fixtures.

  def sync_live
    return unless AppFocus.clubs_primary?

    wc_league_id = AppFocus.league_id_for("WC")
    LiveScoresClient.new.live_matches.each do |raw|
      league_id = raw[:league_id].to_i
      next if wc_league_id && league_id == wc_league_id
      next unless AppFocus.allowed_league?(league_id)

      sync_match(raw)
    end
  end

  private

  def sync_match(raw)
    ext_id = raw[:external_id]
    home   = raw.dig(:home, :name).to_s
    away   = raw.dig(:away, :name).to_s
    return if ext_id.blank? || home.blank? || away.blank?

    home_score = raw.dig(:home, :score)
    away_score = raw.dig(:away, :score)
    status     = raw[:status].to_s
    competition_code = AppFocus.code_for_league_id(raw[:league_id])

    cache_key = "club_live_score_#{ext_id}"
    prev = Rails.cache.read(cache_key)
    current = {
      h: home_score.to_i,
      a: away_score.to_i,
      status: status,
      short: raw[:status_short].to_s
    }

    if prev
      if status == "live" && (current[:h] != prev[:h] || current[:a] != prev[:a])
        notify_goal(raw, home, away, current, competition_code)
      end

      if status == "finished" && prev[:status] != "finished"
        notify_fulltime(raw, home, away, current, competition_code)
      end
    end

    Rails.cache.write(cache_key, current, expires_in: 6.hours)
  end

  def notify_goal(raw, home, away, current, competition_code)
    ext_id = raw[:external_id]
    dedup = "goal_notified_club_#{ext_id}_#{current[:h]}_#{current[:a]}"
    return unless Rails.cache.write(dedup, true, expires_in: 5.minutes, unless_exist: true)

    MatchEventNotificationJob.perform_later(
      event_type:       "goal",
      external_id:      ext_id,
      home_name:        home,
      away_name:        away,
      home_score:       current[:h],
      away_score:       current[:a],
      minute:           raw[:minute],
      scorer:           raw[:last_scorer],
      competition_code: competition_code,
      match_url:        "/matches/#{ext_id}"
    )
  end

  def notify_fulltime(raw, home, away, current, competition_code)
    ext_id = raw[:external_id]
    dedup = "fulltime_notified_club_#{ext_id}"
    return unless Rails.cache.write(dedup, true, expires_in: 24.hours, unless_exist: true)

    MatchEventNotificationJob.perform_later(
      event_type:       "fulltime",
      external_id:      ext_id,
      home_name:        home,
      away_name:        away,
      home_score:       current[:h],
      away_score:       current[:a],
      competition_code: competition_code,
      match_url:        "/matches/#{ext_id}"
    )
  end
end
