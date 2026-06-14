class SyncStandingsJob < ApplicationJob
  queue_as :default

  # Standings only change when a WC match finishes. Skip the API call unless a
  # match is live, kicks off within 2h, or finished within the last ~4h —
  # otherwise the DB-side RecalculateStandingsJob already keeps things current.
  def perform
    wc = Competition.find_by(code: "WC")
    if wc
      active = Match.where(competition: wc, status: "live").exists? ||
               Match.where(competition: wc, status: "scheduled")
                    .where(kickoff_at: Time.current..2.hours.from_now).exists? ||
               Match.where(competition: wc, status: "finished")
                    .where(kickoff_at: 4.hours.ago..Time.current).exists?
      unless active
        Rails.logger.info("[SyncStandingsJob] No recent/active WC matches — skipping API standings sync")
        return
      end
    end

    WorldCupSync.new(competition_code: "WC").sync_standings
    Rails.cache.delete("standings_WC")
  end
end
