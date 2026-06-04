TODAY = Date.today.to_s  # e.g. "2026-06-03"

# ───────────────────────── COMPETITIONS ─────────────────────────
puts "Seeding competitions..."

wc_comp = Competition.find_or_create_by!(code: "WC") do |c|
  c.name             = "FIFA World Cup 2026"
  c.competition_type = "world_cup"
  c.country          = "International"
  c.logo             = "https://crests.football-data.org/WC.png"
end

[
  { code: "PL",  name: "Premier League",         country: "England",       type: "league", logo: "https://crests.football-data.org/PL.png"  },
  { code: "LAL", name: "La Liga",                 country: "Spain",         type: "league", logo: "https://crests.football-data.org/PD.png"  },
  { code: "BL1", name: "Bundesliga",              country: "Germany",       type: "league", logo: "https://crests.football-data.org/BL1.png" },
  { code: "SA",  name: "Serie A",                 country: "Italy",         type: "league", logo: "https://crests.football-data.org/SA.png"  },
  { code: "L1",  name: "Ligue 1",                 country: "France",        type: "league", logo: "https://crests.football-data.org/FL1.png" },
  { code: "UCL", name: "UEFA Champions League",   country: "Europe",        type: "cup",    logo: "https://crests.football-data.org/CL.png"  },
  { code: "CA",  name: "Copa América 2026",        country: "South America", type: "cup",    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/9e/Copa_America_2024_logo.svg/200px-Copa_America_2024_logo.svg.png" },
  { code: "MLS", name: "Major League Soccer",     country: "USA/Canada",    type: "league", logo: "https://flagcdn.com/w80/us.png"           },
].each do |l|
  Competition.find_or_create_by!(code: l[:code]) do |c|
    c.name             = l[:name]
    c.competition_type = l[:type]
    c.country          = l[:country]
    c.logo             = l[:logo]
  end
end

def comp(code) = Competition.find_by!(code: code)

puts "#{Competition.count} competitions"

# ───────────────────────── NATIONAL TEAMS (WC 2026) ─────────────────────────
puts "Seeding World Cup teams..."

WC_TEAMS = [
  { name: "United States",  code: "USA", group: "A", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/us.png"     },
  { name: "Panama",         code: "PAN", group: "A", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/pa.png"     },
  { name: "Bolivia",        code: "BOL", group: "A", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/bo.png"     },
  { name: "Morocco",        code: "MAR", group: "A", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/ma.png"     },
  { name: "Argentina",      code: "ARG", group: "B", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ar.png"     },
  { name: "Chile",          code: "CHI", group: "B", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/cl.png"     },
  { name: "Peru",           code: "PER", group: "B", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/pe.png"     },
  { name: "Australia",      code: "AUS", group: "B", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/au.png"     },
  { name: "Mexico",         code: "MEX", group: "C", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/mx.png"     },
  { name: "Jamaica",        code: "JAM", group: "C", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/jm.png"     },
  { name: "Venezuela",      code: "VEN", group: "C", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ve.png"     },
  { name: "New Zealand",    code: "NZL", group: "C", confederation: "OFC",      flag_url: "https://flagcdn.com/w80/nz.png"     },
  { name: "Brazil",         code: "BRA", group: "D", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/br.png"     },
  { name: "Ecuador",        code: "ECU", group: "D", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ec.png"     },
  { name: "Paraguay",       code: "PAR", group: "D", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/py.png"     },
  { name: "DR Congo",       code: "COD", group: "D", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cd.png"     },
  { name: "Spain",          code: "ESP", group: "E", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/es.png"     },
  { name: "Croatia",        code: "CRO", group: "E", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/hr.png"     },
  { name: "Japan",          code: "JPN", group: "E", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/jp.png"     },
  { name: "Cameroon",       code: "CMR", group: "E", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cm.png"     },
  { name: "Germany",        code: "GER", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/de.png"     },
  { name: "Denmark",        code: "DEN", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/dk.png"     },
  { name: "Saudi Arabia",   code: "KSA", group: "F", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/sa.png"     },
  { name: "Portugal",       code: "POR", group: "G", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/pt.png"     },
  { name: "France",         code: "FRA", group: "G", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/fr.png"     },
  { name: "Uruguay",        code: "URU", group: "G", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/uy.png"     },
  { name: "Algeria",        code: "ALG", group: "G", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/dz.png"     },
  { name: "England",        code: "ENG", group: "H", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/gb-eng.png" },
  { name: "Netherlands",    code: "NED", group: "H", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/nl.png"     },
  { name: "Colombia",       code: "COL", group: "H", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/co.png"     },
  { name: "Senegal",        code: "SEN", group: "H", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/sn.png"     },
].uniq { |t| t[:code] }

WC_TEAMS.each do |attrs|
  Team.find_or_create_by!(code: attrs[:code]) do |t|
    t.name          = attrs[:name]
    t.group         = attrs[:group]
    t.confederation = attrs[:confederation]
    t.flag_url      = attrs[:flag_url]
  end
end

puts "#{Team.count} national teams"

# ───────────────────────── CLUB TEAMS ─────────────────────────
puts "Seeding club teams..."

CLUB_TEAMS = [
  # Premier League
  { code: "ARS",  name: "Arsenal",              flag_url: "https://crests.football-data.org/57.png"  },
  { code: "MCI",  name: "Manchester City",      flag_url: "https://crests.football-data.org/65.png"  },
  { code: "LIV",  name: "Liverpool",            flag_url: "https://crests.football-data.org/64.png"  },
  { code: "CHE",  name: "Chelsea",              flag_url: "https://crests.football-data.org/61.png"  },
  { code: "TOT",  name: "Tottenham",            flag_url: "https://crests.football-data.org/73.png"  },
  { code: "MUN",  name: "Man United",           flag_url: "https://crests.football-data.org/66.png"  },
  { code: "NEW",  name: "Newcastle",            flag_url: "https://crests.football-data.org/67.png"  },
  { code: "AVL",  name: "Aston Villa",          flag_url: "https://crests.football-data.org/58.png"  },
  { code: "BHA",  name: "Brighton",             flag_url: "https://crests.football-data.org/397.png" },
  { code: "WHU",  name: "West Ham",             flag_url: "https://crests.football-data.org/563.png" },
  # La Liga
  { code: "RMA",  name: "Real Madrid",          flag_url: "https://crests.football-data.org/86.png"  },
  { code: "BAR",  name: "Barcelona",            flag_url: "https://crests.football-data.org/81.png"  },
  { code: "ATM",  name: "Atletico Madrid",      flag_url: "https://crests.football-data.org/78.png"  },
  { code: "SEV",  name: "Sevilla",              flag_url: "https://crests.football-data.org/559.png" },
  { code: "RSO",  name: "Real Sociedad",        flag_url: "https://crests.football-data.org/92.png"  },
  { code: "ATH",  name: "Athletic Club",        flag_url: "https://crests.football-data.org/77.png"  },
  { code: "VIL",  name: "Villarreal",           flag_url: "https://crests.football-data.org/94.png"  },
  { code: "VAL",  name: "Valencia CF",          flag_url: "https://crests.football-data.org/95.png"  },
  # Bundesliga
  { code: "BAY",  name: "Bayern Munich",        flag_url: "https://crests.football-data.org/5.png"   },
  { code: "BVB",  name: "Borussia Dortmund",    flag_url: "https://crests.football-data.org/4.png"   },
  { code: "RBL",  name: "RB Leipzig",           flag_url: "https://crests.football-data.org/721.png" },
  { code: "B04",  name: "Bayer Leverkusen",     flag_url: "https://crests.football-data.org/3.png"   },
  { code: "SGE",  name: "Eintracht Frankfurt",  flag_url: "https://crests.football-data.org/19.png"  },
  { code: "WOB",  name: "VfL Wolfsburg",        flag_url: "https://crests.football-data.org/11.png"  },
  # Serie A
  { code: "INT",  name: "Inter Milan",          flag_url: "https://crests.football-data.org/108.png" },
  { code: "ACM",  name: "AC Milan",             flag_url: "https://crests.football-data.org/98.png"  },
  { code: "JUV",  name: "Juventus",             flag_url: "https://crests.football-data.org/109.png" },
  { code: "ROM",  name: "Roma",                 flag_url: "https://crests.football-data.org/100.png" },
  { code: "NAP",  name: "Napoli",               flag_url: "https://crests.football-data.org/113.png" },
  { code: "LAZ",  name: "Lazio",                flag_url: "https://crests.football-data.org/110.png" },
  { code: "ATL",  name: "Atalanta",             flag_url: "https://crests.football-data.org/102.png" },
  { code: "FIO",  name: "Fiorentina",           flag_url: "https://crests.football-data.org/99.png"  },
  # Ligue 1
  { code: "PSG",  name: "Paris SG",             flag_url: "https://crests.football-data.org/524.png" },
  { code: "MON",  name: "Monaco",               flag_url: "https://crests.football-data.org/548.png" },
  { code: "OLM",  name: "Marseille",            flag_url: "https://crests.football-data.org/516.png" },
  { code: "OLY",  name: "Lyon",                 flag_url: "https://crests.football-data.org/523.png" },
  { code: "LIL",  name: "Lille",                flag_url: "https://crests.football-data.org/521.png" },
  { code: "NIC",  name: "Nice",                 flag_url: "https://crests.football-data.org/522.png" },
  # MLS
  { code: "LAF", name: "LAFC",                  flag_url: nil },
  { code: "MIA", name: "Inter Miami",           flag_url: nil },
  { code: "TIM", name: "Portland Timbers",      flag_url: nil },
  { code: "SEA", name: "Seattle Sounders",      flag_url: nil },
  { code: "NYC", name: "NYCFC",                 flag_url: nil },
  { code: "ATU", name: "Atlanta United",        flag_url: nil },
].uniq { |t| t[:code] }

CLUB_TEAMS.each do |attrs|
  Team.find_or_create_by!(code: attrs[:code]) do |t|
    t.name     = attrs[:name]
    t.flag_url = attrs[:flag_url]
  end
end

puts "#{Team.count} teams total"

# ───────────────────────── WC FIXTURES ─────────────────────────
puts "Seeding WC fixtures..."

def team(code)
  Team.find_by(code: code)
end

WC_FIXTURES = [
  { home: "USA", away: "MAR", kickoff: "2026-06-11 19:00", venue: "MetLife Stadium",  group: "A", status: "finished", hs: 2, as: 1 },
  { home: "PAN", away: "BOL", kickoff: "2026-06-11 22:00", venue: "SoFi Stadium",     group: "A", status: "finished", hs: 1, as: 0 },
  { home: "ARG", away: "PER", kickoff: "2026-06-12 19:00", venue: "AT&T Stadium",     group: "B", status: "scheduled" },
  { home: "CHI", away: "AUS", kickoff: "2026-06-12 22:00", venue: "Levi's Stadium",   group: "B", status: "scheduled" },
  { home: "BRA", away: "ECU", kickoff: "2026-06-13 16:00", venue: "Rose Bowl",        group: "D", status: "scheduled" },
  { home: "ESP", away: "JPN", kickoff: "2026-06-13 19:00", venue: "Hard Rock Stadium",group: "E", status: "scheduled" },
  { home: "ENG", away: "SEN", kickoff: "2026-06-14 16:00", venue: "Gillette Stadium", group: "H", status: "scheduled" },
  { home: "GER", away: "KSA", kickoff: "2026-06-14 19:00", venue: "MetLife Stadium",  group: "F", status: "scheduled" },
  { home: "POR", away: "ALG", kickoff: "2026-06-15 16:00", venue: "AT&T Stadium",     group: "G", status: "scheduled" },
  { home: "FRA", away: "URU", kickoff: "2026-06-15 19:00", venue: "Rose Bowl",        group: "G", status: "scheduled" },
  { home: "NED", away: "COL", kickoff: "2026-06-16 16:00", venue: "Levi's Stadium",   group: "H", status: "scheduled" },
  { home: "MEX", away: "VEN", kickoff: "2026-06-16 19:00", venue: "SoFi Stadium",     group: "C", status: "scheduled" },
].uniq { |f| [f[:home], f[:away]] }

WC_FIXTURES.each do |f|
  home = team(f[:home])
  away = team(f[:away])
  next unless home && away

  match = Match.find_or_initialize_by(home_team: home, away_team: away, competition: wc_comp)
  match.update!(
    kickoff_at:  DateTime.parse(f[:kickoff]),
    venue:       f[:venue],
    group_stage: f[:group],
    round:       "Group Stage",
    status:      f[:status],
    home_score:  f[:hs],
    away_score:  f[:as]
  )
end

# Retroactively link any WC matches created without a competition
Match.where(competition: nil).update_all(competition_id: wc_comp.id)

puts "#{Match.where(competition: wc_comp).count} WC matches"

# Seed goals for an already-finished WC match (USA vs Morocco)
usa_mar = Match.joins(:home_team, :away_team)
               .find_by(competition: wc_comp, teams: { code: "USA" })
if usa_mar && usa_mar.goals.empty?
  Goal.create!(match: usa_mar, team: usa_mar.home_team, player_name: "Pulisic", minute: 34, goal_type: "regular")
  Goal.create!(match: usa_mar, team: usa_mar.home_team, player_name: "Reyna",   minute: 67, goal_type: "regular")
  Goal.create!(match: usa_mar, team: usa_mar.away_team, player_name: "En-Nesyri", minute: 55, goal_type: "regular")
end

# ───────────────────────── CLUB LEAGUE FIXTURES ─────────────────────────
puts "Seeding club league fixtures..."

def club(code)
  Team.find_by(code: code)
end

def make_match(comp_code, home_code, away_code, kickoff_str, status:, hs: nil, as_: nil, round: nil, venue: nil)
  competition = Competition.find_by(code: comp_code)
  home = club(home_code) || team(home_code)
  away = club(away_code) || team(away_code)
  return unless competition && home && away

  m = Match.find_or_initialize_by(home_team: home, away_team: away, competition: competition)
  m.update!(
    kickoff_at: DateTime.parse("#{kickoff_str} UTC"),
    status:     status,
    home_score: hs,
    away_score: as_,
    round:      round,
    venue:      venue
  )
end

# ── PREMIER LEAGUE — Final Day ──
make_match("PL", "TOT", "MUN", "#{TODAY} 14:00", status: "finished", hs: 3, as_: 1, round: "Matchday 38")
make_match("PL", "NEW", "AVL", "#{TODAY} 14:00", status: "finished", hs: 2, as_: 0, round: "Matchday 38")
make_match("PL", "ARS", "CHE", "#{TODAY} 14:00", status: "finished", hs: 2, as_: 1, round: "Matchday 38")
make_match("PL", "LIV", "MCI", "#{TODAY} 14:00", status: "finished", hs: 1, as_: 1, round: "Matchday 38")
make_match("PL", "BHA", "WHU", "#{TODAY} 17:00", status: "scheduled",               round: "Matchday 38")
make_match("PL", "MUN", "AVL", "2026-05-27 19:00", status: "finished", hs: 1, as_: 2, round: "Matchday 37")
make_match("PL", "MCI", "ARS", "2026-05-20 19:00", status: "finished", hs: 0, as_: 1, round: "Matchday 36")
make_match("PL", "CHE", "LIV", "2026-05-13 19:00", status: "finished", hs: 2, as_: 3, round: "Matchday 35")

# ── LA LIGA — Final Day ──
make_match("LAL", "BAR", "SEV", "#{TODAY} 14:00", status: "finished", hs: 3, as_: 1, round: "Matchday 38")
make_match("LAL", "RMA", "ATM", "#{TODAY} 14:00", status: "finished", hs: 2, as_: 0, round: "Matchday 38")
make_match("LAL", "ATH", "RSO", "#{TODAY} 17:30", status: "scheduled",               round: "Matchday 38")
make_match("LAL", "VIL", "VAL", "#{TODAY} 17:30", status: "scheduled",               round: "Matchday 38")
make_match("LAL", "RMA", "BAR", "2026-05-25 19:00", status: "finished", hs: 2, as_: 2, round: "Matchday 37")
make_match("LAL", "ATM", "SEV", "2026-05-18 19:00", status: "finished", hs: 1, as_: 0, round: "Matchday 36")

# ── BUNDESLIGA — Final Day ──
make_match("BL1", "BAY", "BVB", "#{TODAY} 13:30", status: "finished", hs: 2, as_: 2, round: "Matchday 34")
make_match("BL1", "RBL", "B04", "#{TODAY} 13:30", status: "finished", hs: 1, as_: 3, round: "Matchday 34")
make_match("BL1", "SGE", "WOB", "#{TODAY} 13:30", status: "scheduled",               round: "Matchday 34")
make_match("BL1", "B04", "BAY", "2026-05-23 13:30", status: "finished", hs: 3, as_: 2, round: "Matchday 33")
make_match("BL1", "BVB", "RBL", "2026-05-16 13:30", status: "finished", hs: 2, as_: 1, round: "Matchday 32")

# ── SERIE A ──
make_match("SA", "JUV", "FIO", "#{TODAY} 13:00", status: "finished", hs: 2, as_: 1, round: "Matchday 37")
make_match("SA", "INT", "ATL", "#{TODAY} 17:45", status: "scheduled",               round: "Matchday 37")
make_match("SA", "ACM", "NAP", "#{TODAY} 19:45", status: "scheduled",               round: "Matchday 37")
make_match("SA", "LAZ", "ROM", "#{TODAY} 19:45", status: "scheduled",               round: "Matchday 37")
make_match("SA", "NAP", "INT", "2026-05-25 19:45", status: "finished", hs: 0, as_: 1, round: "Matchday 36")
make_match("SA", "JUV", "ACM", "2026-05-18 19:45", status: "finished", hs: 1, as_: 1, round: "Matchday 35")

# ── LIGUE 1 ──
make_match("L1", "PSG", "MON", "#{TODAY} 15:05", status: "finished", hs: 2, as_: 2, round: "Matchday 38")
make_match("L1", "OLM", "OLY", "#{TODAY} 19:00", status: "scheduled",               round: "Matchday 38")
make_match("L1", "LIL", "NIC", "#{TODAY} 19:00", status: "scheduled",               round: "Matchday 38")
make_match("L1", "OLY", "PSG", "2026-05-24 19:00", status: "finished", hs: 0, as_: 3, round: "Matchday 37")
make_match("L1", "MON", "LIL", "2026-05-17 15:05", status: "finished", hs: 2, as_: 0, round: "Matchday 36")

# ── UEFA CHAMPIONS LEAGUE ──
make_match("UCL", "MCI", "BAY", "2026-05-30 19:00", status: "finished", hs: 1, as_: 0, round: "Final",      venue: "Allianz Arena, Munich")
make_match("UCL", "RMA", "ARS", "2026-05-06 19:00", status: "finished", hs: 3, as_: 1, round: "Semi Final",  venue: "Santiago Bernabeu")
make_match("UCL", "BAY", "INT", "2026-05-07 19:00", status: "finished", hs: 2, as_: 1, round: "Semi Final",  venue: "Allianz Arena, Munich")
make_match("UCL", "ARS", "RMA", "2026-04-29 19:00", status: "finished", hs: 1, as_: 0, round: "Semi Final",  venue: "Emirates Stadium")
make_match("UCL", "INT", "BAY", "2026-04-30 19:00", status: "finished", hs: 0, as_: 0, round: "Semi Final",  venue: "San Siro")
make_match("UCL", "MCI", "PSG", "2026-04-15 19:00", status: "finished", hs: 2, as_: 1, round: "Quarter Final", venue: "Etihad Stadium")
make_match("UCL", "RMA", "BVB", "2026-04-16 19:00", status: "finished", hs: 3, as_: 2, round: "Quarter Final", venue: "Santiago Bernabeu")

# ── COPA AMÉRICA — Group Stage (today) ──
make_match("CA", "BRA", "COL", "#{TODAY} 00:00", status: "finished", hs: 1, as_: 0, round: "Group Stage", venue: "Estadio Centenario")
make_match("CA", "URU", "ECU", "#{TODAY} 01:00", status: "finished", hs: 2, as_: 1, round: "Group Stage", venue: "Estadio Monumental")
make_match("CA", "ARG", "PER", "#{TODAY} 23:00", status: "scheduled",               round: "Group Stage", venue: "MetLife Stadium")
make_match("CA", "CHI", "VEN", "2026-06-04 01:00", status: "scheduled",             round: "Group Stage", venue: "Hard Rock Stadium")
make_match("CA", "MEX", "JAM", "2026-06-04 23:00", status: "scheduled",             round: "Group Stage", venue: "NRG Stadium")

# ── MLS ──
make_match("MLS", "LAF", "MIA", "#{TODAY} 23:00", status: "scheduled", round: "Regular Season", venue: "BMO Stadium")
make_match("MLS", "TIM", "SEA", "#{TODAY} 02:30", status: "finished",  hs: 1, as_: 2, round: "Regular Season", venue: "Providence Park")
make_match("MLS", "NYC", "ATU", "#{TODAY} 23:30", status: "scheduled", round: "Regular Season", venue: "Yankee Stadium")
make_match("MLS", "SEA", "LAF", "2026-05-31 02:00", status: "finished", hs: 3, as_: 1, round: "Regular Season", venue: "Lumen Field")
make_match("MLS", "MIA", "ATU", "2026-05-28 23:00", status: "finished", hs: 2, as_: 0, round: "Regular Season", venue: "Chase Stadium")

puts "#{Match.count} total matches"
puts "Done! ✓"
