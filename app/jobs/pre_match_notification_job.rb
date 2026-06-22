class PreMatchNotificationJob < ApplicationJob
  queue_as :default

  # Runs every 2 minutes. Finds WC matches kicking off in 8–12 min and sends
  # a "starting soon" push to subscribers following either team.
  def perform
    wc = Competition.find_by(code: "WC")
    return unless wc

    window_start = 8.minutes.from_now
    window_end   = 12.minutes.from_now

    matches = Match.where(competition: wc, status: "scheduled")
                   .where(kickoff_at: window_start..window_end)
                   .includes(:home_team, :away_team)

    Rails.logger.info("[PreMatchNotification] Checked window #{window_start.utc.strftime('%H:%M')}–#{window_end.utc.strftime('%H:%M')} UTC — #{matches.size} match(es) found")

    matches.each do |match|
      cache_key = "prematch_notified_#{match.id}"
      next unless Rails.cache.write(cache_key, true, expires_in: 30.minutes, unless_exist: true)

      next if match.status != "scheduled"

      MatchEventNotificationJob.perform_later(
        event_type: "prematch",
        match_id:   match.id,
        home_name:  match.home_team&.name.to_s,
        away_name:  match.away_team&.name.to_s,
        match_url:  "/matches/#{match.external_id || "db-#{match.id}"}"
      )

      Rails.logger.info("[PreMatchNotification] #{match.home_team&.name} vs #{match.away_team&.name} kicks off at #{match.kickoff_at}")
    end
  end
end
