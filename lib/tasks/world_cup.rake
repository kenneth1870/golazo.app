namespace :world_cup do
  desc "Full sync: teams, fixtures, standings (football-data.org WC 2026)"
  task sync: :environment do
    WorldCupSync.new.sync_all
  end

  desc "Sync today's matches"
  task sync_today: :environment do
    WorldCupSync.new.sync_today
  end

  desc "Sync live match scores (run every 60s during matches)"
  task sync_live: :environment do
    WorldCupSync.new.sync_live
  end

  desc "Sync standings only"
  task sync_standings: :environment do
    WorldCupSync.new.sync_standings
  end
end
