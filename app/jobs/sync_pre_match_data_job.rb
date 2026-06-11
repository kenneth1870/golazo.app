class SyncPreMatchDataJob < ApplicationJob
  queue_as :default

  # Runs every 5 minutes. For each WC match kicking off within 90 minutes:
  # 1. Fetches full match detail from API-Football v3 (warms lineup/events/stats cache).
  # 2. If lineups are newly available, fires SendLineupAlertJob and records
  #    lineups_notified_at so we don't double-notify.
  #
  # Requires: match.external_id is an API-Football fixture ID (set by
  # WorldCupSync#sync_external_ids_from_api_football).
  def perform
    window_end = Time.current + 90.minutes

    upcoming = Match
      .includes(:home_team, :away_team)
      .where(status: %w[scheduled tbd ns NS TBD])
      .where(kickoff_at: Time.current..window_end)
      .where(lineups_notified_at: nil)
      .where.not(external_id: nil)

    return if upcoming.empty?
    Rails.logger.info("[PreMatch] #{upcoming.size} match(es) in 90-min window")

    client = LiveScoresClient.new

    upcoming.each do |match|
      next unless match.home_team && match.away_team

      begin
        detail = client.match_detail(match.external_id)
        lineups = detail&.dig(:lineups) || []
        has_lineups = lineups.any? { |l| l&.dig(:start_xi)&.any? }

        if has_lineups
          match.update_column(:lineups_notified_at, Time.current)
          SendLineupAlertJob.perform_later(
            match_id:   match.id,
            home_name:  match.home_team.name,
            away_name:  match.away_team.name,
            kickoff_at: match.kickoff_at,
            match_url:  "/matches/#{match.external_id}",
          )
          Rails.logger.info("[PreMatch] Lineup alert queued: #{match.home_team.name} vs #{match.away_team.name}")
        else
          Rails.logger.info("[PreMatch] No lineups yet: #{match.home_team.name} vs #{match.away_team.name}")
        end
      rescue => e
        Rails.logger.error("[PreMatch] match #{match.id}: #{e.message}")
      end
    end
  end
end
