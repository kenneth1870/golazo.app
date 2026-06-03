namespace :world_cup do
  desc "Sync all World Cup data (teams, fixtures, standings)"
  task sync: :environment do
    WorldCupSync.new.sync_all
  end

  desc "Sync only live match scores"
  task sync_live: :environment do
    WorldCupSync.new.sync_live
  end

  desc "Sync detailed stats and goals for a specific match (MATCH_ID=...)"
  task sync_match: :environment do
    match = Match.find(ENV["MATCH_ID"])
    WorldCupSync.new.sync_fixture_details(match)
    puts "Done."
  end
end
