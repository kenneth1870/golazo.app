class PreMatchNotificationJob < ApplicationJob
  queue_as :default

  # Runs every 2 minutes. Finds matches kicking off in 8–12 min and sends
  # a "starting soon" push to subscribers following either team or league.
  def perform
    return unless AppFocus.push_enabled?

    window_start = 8.minutes.from_now
    window_end   = 12.minutes.from_now

    matches = db_prematch_matches(window_start, window_end)
    matches.concat(api_prematch_matches(window_start, window_end)) if AppFocus.clubs_primary?

    Rails.logger.info("[PreMatchNotification] Checked window #{window_start.utc.strftime('%H:%M')}–#{window_end.utc.strftime('%H:%M')} UTC — #{matches.size} match(es) found")

    fresh = matches.select do |match|
      dedup_key = prematch_dedup_key(match)
      Rails.cache.write(dedup_key, true, expires_in: 30.minutes, unless_exist: true)
    end
    return if fresh.empty?

    PreMatchBundleNotificationJob.perform_later(matches: fresh)

    fresh.each do |match|
      Rails.logger.info("[PreMatchNotification] #{match[:home]} vs #{match[:away]} (#{match[:competition_code]})")
    end
  end

  private

  def db_prematch_matches(window_start, window_end)
    return [] if AppFocus.wc_paused?

    competitions = []
    competitions << Competition.find_by(code: "WC") if AppFocus.wc_primary?
    competitions.compact!

    return [] if competitions.empty?

    Match.where(competition: competitions, status: "scheduled")
         .where(kickoff_at: window_start..window_end)
         .includes(:home_team, :away_team, :competition)
         .order(:kickoff_at)
         .map { |match| serialize_db_match(match) }
  end

  def api_prematch_matches(window_start, window_end)
    wc_league_id = AppFocus.league_id_for("WC")
    client = LiveScoresClient.new
    dates = [ Date.current, Date.current + 1 ]

    dates.flat_map { |date| client.matches_for_date(date) }.filter_map do |raw|
      next unless raw[:status] == "scheduled"
      next unless AppFocus.allowed_league?(raw[:league_id])
      next if wc_league_id && raw[:league_id].to_i == wc_league_id

      kickoff = Time.parse(raw[:kickoff_at].to_s).utc
      next unless kickoff.between?(window_start, window_end)

      {
        id:               "api-#{raw[:external_id]}",
        external_id:      raw[:external_id],
        home:             raw.dig(:home, :name).to_s,
        away:             raw.dig(:away, :name).to_s,
        home_code:        nil,
        away_code:        nil,
        url:              "/matches/#{raw[:external_id]}",
        competition_code: AppFocus.code_for_league_id(raw[:league_id])
      }
    end.uniq { |m| m[:external_id] }
  rescue => e
    Rails.logger.error("[PreMatchNotification] api_prematch_matches: #{e.message}")
    []
  end

  def serialize_db_match(match)
    {
      id:               match.id,
      home:             match.home_team&.name.to_s,
      away:             match.away_team&.name.to_s,
      home_code:        match.home_team&.code,
      away_code:        match.away_team&.code,
      url:              "/matches/#{match.external_id || "db-#{match.id}"}",
      competition_code: match.competition&.code
    }
  end

  def prematch_dedup_key(match)
    if match[:external_id].present? && match[:id].to_s.start_with?("api-")
      "prematch_notified_api_#{match[:external_id]}"
    else
      "prematch_notified_#{match[:id]}"
    end
  end
end
