puts "Seeding Mundial 2026 teams..."

TEAMS = [
  # Group A
  { name: "United States", code: "USA", group: "A", confederation: "CONCACAF",
    flag_url: "https://flagcdn.com/w80/us.png" },
  { name: "Panama", code: "PAN", group: "A", confederation: "CONCACAF",
    flag_url: "https://flagcdn.com/w80/pa.png" },
  { name: "Bolivia", code: "BOL", group: "A", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/bo.png" },
  { name: "Morocco", code: "MAR", group: "A", confederation: "CAF",
    flag_url: "https://flagcdn.com/w80/ma.png" },

  # Group B
  { name: "Argentina", code: "ARG", group: "B", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/ar.png" },
  { name: "Chile", code: "CHI", group: "B", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/cl.png" },
  { name: "Peru", code: "PER", group: "B", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/pe.png" },
  { name: "Australia", code: "AUS", group: "B", confederation: "AFC",
    flag_url: "https://flagcdn.com/w80/au.png" },

  # Group C
  { name: "Mexico", code: "MEX", group: "C", confederation: "CONCACAF",
    flag_url: "https://flagcdn.com/w80/mx.png" },
  { name: "Jamaica", code: "JAM", group: "C", confederation: "CONCACAF",
    flag_url: "https://flagcdn.com/w80/jm.png" },
  { name: "Venezuela", code: "VEN", group: "C", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/ve.png" },
  { name: "New Zealand", code: "NZL", group: "C", confederation: "OFC",
    flag_url: "https://flagcdn.com/w80/nz.png" },

  # Group D
  { name: "Brazil", code: "BRA", group: "D", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/br.png" },
  { name: "Ecuador", code: "ECU", group: "D", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/ec.png" },
  { name: "Paraguay", code: "PAR", group: "D", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/py.png" },
  { name: "DR Congo", code: "COD", group: "D", confederation: "CAF",
    flag_url: "https://flagcdn.com/w80/cd.png" },

  # Group E
  { name: "Spain", code: "ESP", group: "E", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/es.png" },
  { name: "Croatia", code: "CRO", group: "E", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/hr.png" },
  { name: "Japan", code: "JPN", group: "E", confederation: "AFC",
    flag_url: "https://flagcdn.com/w80/jp.png" },
  { name: "Cameroon", code: "CMR", group: "E", confederation: "CAF",
    flag_url: "https://flagcdn.com/w80/cm.png" },

  # Group F
  { name: "Germany", code: "GER", group: "F", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/de.png" },
  { name: "Denmark", code: "DEN", group: "F", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/dk.png" },
  { name: "Mexico", code: "MEX", group: "F", confederation: "CONCACAF",
    flag_url: "https://flagcdn.com/w80/mx.png" },
  { name: "Saudi Arabia", code: "KSA", group: "F", confederation: "AFC",
    flag_url: "https://flagcdn.com/w80/sa.png" },

  # Group G
  { name: "Portugal", code: "POR", group: "G", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/pt.png" },
  { name: "France", code: "FRA", group: "G", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/fr.png" },
  { name: "Uruguay", code: "URU", group: "G", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/uy.png" },
  { name: "Algeria", code: "ALG", group: "G", confederation: "CAF",
    flag_url: "https://flagcdn.com/w80/dz.png" },

  # Group H
  { name: "England", code: "ENG", group: "H", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/gb-eng.png" },
  { name: "Netherlands", code: "NED", group: "H", confederation: "UEFA",
    flag_url: "https://flagcdn.com/w80/nl.png" },
  { name: "Colombia", code: "COL", group: "H", confederation: "CONMEBOL",
    flag_url: "https://flagcdn.com/w80/co.png" },
  { name: "Senegal", code: "SEN", group: "H", confederation: "CAF",
    flag_url: "https://flagcdn.com/w80/sn.png" },
].uniq { |t| t[:code] }

TEAMS.each do |attrs|
  Team.find_or_create_by!(code: attrs[:code]) do |t|
    t.name = attrs[:name]
    t.group = attrs[:group]
    t.confederation = attrs[:confederation]
    t.flag_url = attrs[:flag_url]
  end
end

puts "Created #{Team.count} teams"

puts "Seeding sample matches..."

def team(code)
  Team.find_by!(code: code)
rescue ActiveRecord::RecordNotFound
  nil
end

FIXTURES = [
  { home: "USA", away: "MAR", kickoff: "2026-06-11 19:00", venue: "MetLife Stadium", group: "A", status: "finished", home_score: 2, away_score: 1 },
  { home: "PAN", away: "BOL", kickoff: "2026-06-11 22:00", venue: "SoFi Stadium", group: "A", status: "finished", home_score: 1, away_score: 0 },
  { home: "ARG", away: "PER", kickoff: "2026-06-12 19:00", venue: "AT&T Stadium", group: "B", status: "live", home_score: 1, away_score: 0 },
  { home: "CHI", away: "AUS", kickoff: "2026-06-12 22:00", venue: "Levi's Stadium", group: "B", status: "scheduled", home_score: nil, away_score: nil },
  { home: "BRA", away: "ECU", kickoff: "2026-06-13 16:00", venue: "Rose Bowl", group: "D", status: "scheduled", home_score: nil, away_score: nil },
  { home: "ESP", away: "JPN", kickoff: "2026-06-13 19:00", venue: "Hard Rock Stadium", group: "E", status: "scheduled", home_score: nil, away_score: nil },
  { home: "ENG", away: "SEN", kickoff: "2026-06-14 16:00", venue: "Gillette Stadium", group: "H", status: "scheduled", home_score: nil, away_score: nil },
  { home: "GER", away: "KSA", kickoff: "2026-06-14 19:00", venue: "MetLife Stadium", group: "F", status: "scheduled", home_score: nil, away_score: nil },
]

FIXTURES.each do |f|
  home = Team.find_by(code: f[:home])
  away = Team.find_by(code: f[:away])
  next unless home && away

  match = Match.find_or_initialize_by(home_team: home, away_team: away)
  match.update!(
    kickoff_at: DateTime.parse(f[:kickoff]),
    venue: f[:venue],
    group_stage: f[:group],
    round: "Group Stage",
    status: f[:status],
    home_score: f[:home_score],
    away_score: f[:away_score]
  )
end

puts "Created #{Match.count} matches"

# Seed some goals for finished/live matches
live_match = Match.find_by(status: "live")
if live_match && live_match.goals.empty?
  Goal.create!(
    match: live_match,
    team: live_match.home_team,
    player_name: "L. Messi",
    minute: 23,
    goal_type: "regular"
  )
  puts "Seeded goals for live match"
end

puts "Done! ✓"
