namespace :golazo do
  desc "Full sync for a competition (COMPETITION=WC)"
  task sync: :environment do
    code = ENV.fetch("COMPETITION", "WC")
    WorldCupSync.new(competition_code: code).sync_all
  end

  desc "Sync today's matches across all available competitions"
  task sync_today: :environment do
    WorldCupSync.new.sync_today
  end

  desc "Sync live match scores via RapidAPI"
  task sync_live: :environment do
    WorldCupSync.new.sync_live
  end

  desc "Sync standings for a competition (COMPETITION=WC)"
  task sync_standings: :environment do
    code = ENV.fetch("COMPETITION", "WC")
    WorldCupSync.new(competition_code: code).sync_standings
  end

  desc "Sync team and match external_ids from football-data.org"
  task sync_football_data: :environment do
    WorldCupSync.new.sync_from_football_data
  end

  desc "Import/refresh the WC group-stage schedule from db/world_cup_group_fixtures.yml"
  task load_group_fixtures: :environment do
    WorldCupSync.new(competition_code: "WC").import_group_fixtures
  end

  desc "Create the knockout bracket fixtures and (re)populate them from results"
  task load_knockout: :environment do
    WorldCupKnockout.new.ensure_fixtures!
    WorldCupKnockout.rebuild!
  end

  desc "Load the full WC schedule (group fixtures + knockout bracket)"
  task load_schedule: %i[load_group_fixtures load_knockout]

  desc "Heal all WC match data (re-syncs every date, restamps scrambled external_ids)"
  task heal_all: :environment do
    sync = WorldCupSync.new(competition_code: "WC")
    fixed = sync.resync_all_wc_match_dates
    resolved = sync.resolve_knockout_from_api
    RecalculateStandingsJob.perform_now
    puts "Done — #{fixed} match(es) corrected, #{resolved} knockout slot(s) resolved"
  end

  desc "Force-sync today and tomorrow (busts cache, restamps teams)"
  task sync_force_today: :environment do
    sync = WorldCupSync.new(competition_code: "WC")
    sync.force_sync_dates([ Date.today, Date.today + 1 ])
    puts "Done"
  end
end
