class FixR32TeamPairings < ActiveRecord::Migration[8.1]
  def up
    return unless Rails.env.production?

    # Directly patch R32 knockout slots that have wrong away-team assignments.
    # Cross-checked against official FIFA schedule and API-Football fixture IDs.
    # Also syncs today (June 30) and exact-midnight-UTC July 1 slots that the
    # previous heal migration skipped (it started at Date.today+1).
    sync = WorldCupSync.new(competition_code: "WC")

    # June 30 — France vs Sweden (was France vs DR Congo in the wrong slot)
    sync.force_sync_dates([ Date.new(2026, 6, 30) ])

    # July 1 — Mexico vs Ecuador, Belgium vs Senegal, USA vs Bosnia
    sync.force_sync_dates([ Date.new(2026, 7, 1) ])

    # July 2 — Spain vs Austria, Portugal vs Croatia
    sync.force_sync_dates([ Date.new(2026, 7, 2) ])

    # July 3 — Switzerland vs Algeria (was Switzerland vs Paraguay),
    #           Australia vs Egypt, Argentina vs Cape Verde, Colombia vs Ghana
    sync.force_sync_dates([ Date.new(2026, 7, 3) ])

    # July 4 — Canada vs Morocco, Paraguay vs next opponent
    sync.force_sync_dates([ Date.new(2026, 7, 4) ])
  end

  def down; end
end
