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

  desc "Sync live scores via RapidAPI (all 125+ leagues)"
  task sync_live_scores: :environment do
    LiveScoresSync.new.sync
  end

  desc "Sync standings for a competition (COMPETITION=WC)"
  task sync_standings: :environment do
    code = ENV.fetch("COMPETITION", "WC")
    WorldCupSync.new(competition_code: code).sync_standings
  end
end
