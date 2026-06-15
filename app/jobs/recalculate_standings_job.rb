class RecalculateStandingsJob < ApplicationJob
  queue_as :default

  # Debounce: if another job fires within 10 seconds, skip — the earlier one
  # will handle it. Prevents stampedes when multiple WC matches finish at once.
  discard_on(ActiveJob::DeserializationError)

  def perform
    wc = Competition.find_by(code: "WC")
    if wc
      active = Match.where(competition: wc)
                    .where(
                      "(status IN ('live','finished') AND kickoff_at > ?) OR " \
                      "(status = 'scheduled' AND kickoff_at BETWEEN ? AND ?)",
                      12.hours.ago,
                      12.hours.ago, 2.hours.from_now
                    )
                    .exists?
      unless active
        Rails.logger.info("[RecalculateStandingsJob] No active WC matches — skipping")
        return
      end
    end

    lock_key = "recalculate_standings_running"
    if Rails.cache.read(lock_key)
      # Another instance is running — schedule a follow-up so this trigger isn't lost
      self.class.set(wait: 35.seconds).perform_later
      return
    end

    Rails.cache.write(lock_key, true, expires_in: 30.seconds)
    backfill_group_stage_for_wc(wc) if wc
    sync = WorldCupSync.new(competition_code: "WC")
    sync.recalculate_standings_from_results
    WorldCupKnockout.rebuild!
    Rails.cache.delete("standings_WC")
    Rails.cache.write("standings_last_recalculated_at", Time.current.iso8601, expires_in: 2.days)
    ActionCable.server.broadcast("standings_updates", { type: "standings_updated", competition: "WC" })
  ensure
    Rails.cache.delete(lock_key)
  end

  private

  # Backfill group_stage for any finished WC group match that was finalized
  # before the live-sync path started writing it. Reads from team.group as the
  # authoritative source (set during seeding).
  def backfill_group_stage_for_wc(wc)
    Match.where(competition: wc, status: "finished", group_stage: nil)
         .includes(:home_team, :away_team)
         .find_each do |m|
      group = m.home_team&.group.presence || m.away_team&.group.presence
      next unless group
      # Only backfill if both teams are in the same group (true group-stage match)
      next unless m.home_team&.group == m.away_team&.group
      m.update_columns(group_stage: group)
    end
  end
end
