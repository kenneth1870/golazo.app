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

  desc "Sync live match scores (run every 60s on match days)"
  task sync_live: :environment do
    WorldCupSync.new.sync_live
  end

  desc "Sync standings for a competition (COMPETITION=WC)"
  task sync_standings: :environment do
    code = ENV.fetch("COMPETITION", "WC")
    WorldCupSync.new(competition_code: code).sync_standings
  end
end

# Keep old namespace as alias
namespace :world_cup do
  task sync:          "golazo:sync"
  task sync_today:    "golazo:sync_today"
  task sync_live:     "golazo:sync_live"
  task sync_standings:"golazo:sync_standings"
end
