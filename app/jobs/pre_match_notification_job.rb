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
                   .order(:kickoff_at)

    Rails.logger.info("[PreMatchNotification] Checked window #{window_start.utc.strftime('%H:%M')}–#{window_end.utc.strftime('%H:%M')} UTC — #{matches.size} match(es) found")

    # Atomically claim each match so it's only ever notified once, even across
    # the overlapping 2-minute runs. Matches that survive the claim are bundled
    # into a single notification (see PreMatchBundleNotificationJob) so two games
    # kicking off together produce one push listing both — not two competing ones.
    fresh = matches.select do |match|
      Rails.cache.write("prematch_notified_#{match.id}", true, expires_in: 30.minutes, unless_exist: true) &&
        match.status == "scheduled"
    end
    return if fresh.empty?

    PreMatchBundleNotificationJob.perform_later(
      matches: fresh.map do |match|
        {
          id:        match.id,
          home:      match.home_team&.name.to_s,
          away:      match.away_team&.name.to_s,
          home_code: match.home_team&.code,
          away_code: match.away_team&.code,
          url:       "/matches/#{match.external_id || "db-#{match.id}"}"
        }
      end
    )

    fresh.each do |match|
      Rails.logger.info("[PreMatchNotification] #{match.home_team&.name} vs #{match.away_team&.name} kicks off at #{match.kickoff_at}")
    end
  end
end
