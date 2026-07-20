# ───────────────────────── COMPETITIONS ─────────────────────────
puts "Seeding competitions..."

wc_comp = Competition.find_or_create_by!(code: "WC") do |c|
  c.name             = "FIFA World Cup 2026"
  c.competition_type = "world_cup"
  c.country          = "International"
  c.logo             = "https://crests.football-data.org/WC.png"
end

[
  { code: "PL",  name: "Premier League",       country: "England",    type: "league", logo: "https://crests.football-data.org/PL.png",  ext: 39  },
  { code: "LAL", name: "La Liga",               country: "Spain",      type: "league", logo: "https://crests.football-data.org/PD.png",  ext: 140 },
  { code: "BL1", name: "Bundesliga",            country: "Germany",    type: "league", logo: "https://crests.football-data.org/BL1.png", ext: 78  },
  { code: "SA",  name: "Serie A",               country: "Italy",      type: "league", logo: "https://crests.football-data.org/SA.png",  ext: 135 },
  { code: "L1",  name: "Ligue 1",               country: "France",     type: "league", logo: "https://crests.football-data.org/FL1.png", ext: 61  },
  { code: "UCL", name: "UEFA Champions League", country: "Europe",     type: "cup",    logo: "https://crests.football-data.org/CL.png",  ext: 2   },
  { code: "MLS", name: "Major League Soccer",   country: "USA/Canada", type: "league", logo: "https://flagcdn.com/w80/us.png",           ext: 253 },
  { code: "CRC", name: "Liga Tica",             country: "Costa Rica", type: "league", logo: "https://media.api-sports.io/football/leagues/162.png", ext: 162 },
  { code: "LMX", name: "Liga MX",               country: "Mexico",     type: "league", logo: "https://media.api-sports.io/football/leagues/262.png", ext: 262 }
].each do |l|
  comp = Competition.find_or_create_by!(code: l[:code]) do |c|
    c.name             = l[:name]
    c.competition_type = l[:type]
    c.country          = l[:country]
    c.logo             = l[:logo]
    c.external_id      = l[:ext]
  end
  comp.update!(external_id: l[:ext]) if comp.external_id != l[:ext]
end

wc_comp.update!(external_id: 1) if wc_comp.external_id != 1

# Remove Copa América 2026 — not a real 2026 competition
Competition.find_by(code: "CA")&.destroy

puts "#{Competition.count} competitions"

# ───────────────────────── NATIONAL TEAMS (WC 2026) ─────────────────────────
# Official FIFA WC 2026 draw — December 5, 2024 — Kennedy Center, Washington D.C.
puts "Seeding World Cup teams..."

WC_TEAMS = [
  # Group A — Mexico City / Guadalajara (host: Mexico)
  { name: "Mexico",        code: "MEX", group: "A", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/mx.png"     },
  { name: "South Africa",  code: "RSA", group: "A", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/za.png"     },
  { name: "South Korea",   code: "KOR", group: "A", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/kr.png"     },
  { name: "Czechia",       code: "CZE", group: "A", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/cz.png"     },
  # Group B — Toronto / Vancouver (host: Canada)
  { name: "Canada",        code: "CAN", group: "B", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/ca.png"     },
  { name: "Bosnia & Herz.", code: "BIH", group: "B", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/ba.png"     },
  { name: "Qatar",         code: "QAT", group: "B", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/qa.png"     },
  { name: "Switzerland",   code: "SUI", group: "B", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/ch.png"     },
  # Group C — Los Angeles / San Francisco
  { name: "Brazil",        code: "BRA", group: "C", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/br.png"     },
  { name: "Morocco",       code: "MAR", group: "C", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/ma.png"     },
  { name: "Haiti",         code: "HAI", group: "C", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/ht.png"     },
  { name: "Scotland",      code: "SCO", group: "C", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/gb-sct.png" },
  # Group D — Dallas / Houston (host: United States)
  { name: "United States", code: "USA", group: "D", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/us.png"     },
  { name: "Paraguay",      code: "PAR", group: "D", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/py.png"     },
  { name: "Australia",     code: "AUS", group: "D", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/au.png"     },
  { name: "Turkey",        code: "TUR", group: "D", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/tr.png"     },
  # Group E — Atlanta / Miami
  { name: "Germany",       code: "GER", group: "E", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/de.png"     },
  { name: "Curacao",       code: "CUW", group: "E", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/cw.png"     },
  { name: "Ivory Coast",   code: "CIV", group: "E", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/ci.png"     },
  { name: "Ecuador",       code: "ECU", group: "E", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ec.png"     },
  # Group F — Seattle / San Francisco
  { name: "Netherlands",   code: "NED", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/nl.png"     },
  { name: "Japan",         code: "JPN", group: "F", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/jp.png"     },
  { name: "Sweden",        code: "SWE", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/se.png"     },
  { name: "Tunisia",       code: "TUN", group: "F", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/tn.png"     },
  # Group G — Kansas City / Cincinnati
  { name: "Belgium",       code: "BEL", group: "G", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/be.png"     },
  { name: "Egypt",         code: "EGY", group: "G", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/eg.png"     },
  { name: "Iran",          code: "IRN", group: "G", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/ir.png"     },
  { name: "New Zealand",   code: "NZL", group: "G", confederation: "OFC",      flag_url: "https://flagcdn.com/w80/nz.png"     },
  # Group H — Miami / Atlanta
  { name: "Spain",         code: "ESP", group: "H", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/es.png"     },
  { name: "Cape Verde",    code: "CPV", group: "H", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cv.png"     },
  { name: "Saudi Arabia",  code: "KSA", group: "H", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/sa.png"     },
  { name: "Uruguay",       code: "URU", group: "H", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/uy.png"     },
  # Group I — Chicago / Boston
  { name: "France",        code: "FRA", group: "I", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/fr.png"     },
  { name: "Senegal",       code: "SEN", group: "I", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/sn.png"     },
  { name: "Iraq",          code: "IRQ", group: "I", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/iq.png"     },
  { name: "Norway",        code: "NOR", group: "I", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/no.png"     },
  # Group J — New York / New Jersey
  { name: "Argentina",     code: "ARG", group: "J", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ar.png"     },
  { name: "Algeria",       code: "ALG", group: "J", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/dz.png"     },
  { name: "Austria",       code: "AUT", group: "J", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/at.png"     },
  { name: "Jordan",        code: "JOR", group: "J", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/jo.png"     },
  # Group K — Los Angeles / San Diego
  { name: "Portugal",      code: "POR", group: "K", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/pt.png"     },
  { name: "DR Congo",      code: "COD", group: "K", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cd.png"     },
  { name: "Uzbekistan",    code: "UZB", group: "K", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/uz.png"     },
  { name: "Colombia",      code: "COL", group: "K", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/co.png"     },
  # Group L — Boston / Philadelphia
  { name: "England",       code: "ENG", group: "L", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/gb-eng.png" },
  { name: "Croatia",       code: "CRO", group: "L", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/hr.png"     },
  { name: "Ghana",         code: "GHA", group: "L", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/gh.png"     },
  { name: "Panama",        code: "PAN", group: "L", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/pa.png"     }
].uniq { |t| t[:code] }

WC_TEAMS.each do |attrs|
  t = Team.find_or_initialize_by(code: attrs[:code])
  t.name          = attrs[:name]
  t.group         = attrs[:group]
  t.confederation = attrs[:confederation]
  t.flag_url      = attrs[:flag_url]
  t.save!
end

# Clear group assignment from any old placeholder teams not in the real WC draw
WC_CODES = WC_TEAMS.map { |t| t[:code] }
Team.where.not(code: WC_CODES).where.not(group: [ nil, "" ]).update_all(group: nil)

puts "#{Team.where.not(group: nil).count} WC teams seeded"

# ───────────────────────── CLUB TEAMS ─────────────────────────
puts "Seeding club teams..."

[
  # Premier League
  { code: "ARS", name: "Arsenal",             flag_url: "https://crests.football-data.org/57.png"  },
  { code: "MCI", name: "Manchester City",      flag_url: "https://crests.football-data.org/65.png"  },
  { code: "LIV", name: "Liverpool",            flag_url: "https://crests.football-data.org/64.png"  },
  { code: "CHE", name: "Chelsea",              flag_url: "https://crests.football-data.org/61.png"  },
  { code: "TOT", name: "Tottenham",            flag_url: "https://crests.football-data.org/73.png"  },
  { code: "MUN", name: "Man United",           flag_url: "https://crests.football-data.org/66.png"  },
  { code: "NEW", name: "Newcastle",            flag_url: "https://crests.football-data.org/67.png"  },
  { code: "AVL", name: "Aston Villa",          flag_url: "https://crests.football-data.org/58.png"  },
  { code: "BHA", name: "Brighton",             flag_url: "https://crests.football-data.org/397.png" },
  { code: "WHU", name: "West Ham",             flag_url: "https://crests.football-data.org/563.png" },
  # La Liga
  { code: "RMA", name: "Real Madrid",          flag_url: "https://crests.football-data.org/86.png"  },
  { code: "BAR", name: "Barcelona",            flag_url: "https://crests.football-data.org/81.png"  },
  { code: "ATM", name: "Atletico Madrid",      flag_url: "https://crests.football-data.org/78.png"  },
  { code: "SEV", name: "Sevilla",              flag_url: "https://crests.football-data.org/559.png" },
  { code: "RSO", name: "Real Sociedad",        flag_url: "https://crests.football-data.org/92.png"  },
  { code: "ATH", name: "Athletic Club",        flag_url: "https://crests.football-data.org/77.png"  },
  { code: "VIL", name: "Villarreal",           flag_url: "https://crests.football-data.org/94.png"  },
  { code: "VAL", name: "Valencia CF",          flag_url: "https://crests.football-data.org/95.png"  },
  # Bundesliga
  { code: "BAY", name: "Bayern Munich",        flag_url: "https://crests.football-data.org/5.png"   },
  { code: "BVB", name: "Borussia Dortmund",    flag_url: "https://crests.football-data.org/4.png"   },
  { code: "RBL", name: "RB Leipzig",           flag_url: "https://crests.football-data.org/721.png" },
  { code: "B04", name: "Bayer Leverkusen",     flag_url: "https://crests.football-data.org/3.png"   },
  { code: "SGE", name: "Eintracht Frankfurt",  flag_url: "https://crests.football-data.org/19.png"  },
  { code: "WOB", name: "VfL Wolfsburg",        flag_url: "https://crests.football-data.org/11.png"  },
  # Serie A
  { code: "INT", name: "Inter Milan",          flag_url: "https://crests.football-data.org/108.png" },
  { code: "ACM", name: "AC Milan",             flag_url: "https://crests.football-data.org/98.png"  },
  { code: "JUV", name: "Juventus",             flag_url: "https://crests.football-data.org/109.png" },
  { code: "ROM", name: "Roma",                 flag_url: "https://crests.football-data.org/100.png" },
  { code: "NAP", name: "Napoli",               flag_url: "https://crests.football-data.org/113.png" },
  { code: "LAZ", name: "Lazio",                flag_url: "https://crests.football-data.org/110.png" },
  { code: "ATL", name: "Atalanta",             flag_url: "https://crests.football-data.org/102.png" },
  { code: "FIO", name: "Fiorentina",           flag_url: "https://crests.football-data.org/99.png"  },
  # Ligue 1
  { code: "PSG", name: "Paris SG",             flag_url: "https://crests.football-data.org/524.png" },
  { code: "MON", name: "Monaco",               flag_url: "https://crests.football-data.org/548.png" },
  { code: "OLM", name: "Marseille",            flag_url: "https://crests.football-data.org/516.png" },
  { code: "OLY", name: "Lyon",                 flag_url: "https://crests.football-data.org/523.png" },
  { code: "LIL", name: "Lille",                flag_url: "https://crests.football-data.org/521.png" },
  { code: "NIC", name: "Nice",                 flag_url: "https://crests.football-data.org/522.png" },
  # MLS
  { code: "LAF", name: "LAFC",                 flag_url: nil },
  { code: "MIA", name: "Inter Miami",          flag_url: nil },
  { code: "TIM", name: "Portland Timbers",     flag_url: nil },
  { code: "SEA", name: "Seattle Sounders",     flag_url: nil },
  { code: "NYC", name: "NYCFC",                flag_url: nil },
  { code: "ATU", name: "Atlanta United",       flag_url: nil }
].each do |attrs|
  Team.find_or_create_by!(code: attrs[:code]) do |t|
    t.name     = attrs[:name]
    t.flag_url = attrs[:flag_url]
  end
end

puts "#{Team.count} teams total"

# ───────────────────────── WC 2026 FIXTURES ─────────────────────────
# Official FIFA schedule — all times UTC
puts "Seeding WC fixtures..."

def wc_team(code) = Team.find_by!(code: code)

# All kickoff times converted to UTC from the official local times.
# Venues matched to official FIFA WC 2026 stadiums.
WC_FIXTURES = [
  # ── Group A — Mexico, South Africa, South Korea, Czechia ──
  # 13:00 UTC-6 = 19:00 UTC | 20:00 UTC-6 = 02:00 UTC+1
  { home: "MEX", away: "RSA", kickoff: "2026-06-11 19:00 UTC", venue: "Estadio Azteca, Mexico City",                     group: "A", round: "Matchday 1"  },
  { home: "KOR", away: "CZE", kickoff: "2026-06-12 02:00 UTC", venue: "Estadio Akron, Guadalajara",                      group: "A", round: "Matchday 1"  },
  { home: "CZE", away: "RSA", kickoff: "2026-06-18 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",                  group: "A", round: "Matchday 8"  },
  { home: "MEX", away: "KOR", kickoff: "2026-06-19 01:00 UTC", venue: "Estadio Akron, Guadalajara",                      group: "A", round: "Matchday 8"  },
  { home: "CZE", away: "MEX", kickoff: "2026-06-25 01:00 UTC", venue: "Estadio Azteca, Mexico City",                     group: "A", round: "Matchday 14" },
  { home: "RSA", away: "KOR", kickoff: "2026-06-25 01:00 UTC", venue: "Estadio BBVA, Monterrey",                         group: "A", round: "Matchday 14" },
  # ── Group B — Canada, Bosnia & Herz., Qatar, Switzerland ──
  { home: "CAN", away: "BIH", kickoff: "2026-06-12 19:00 UTC", venue: "BMO Field, Toronto",                              group: "B", round: "Matchday 2"  },
  { home: "QAT", away: "SUI", kickoff: "2026-06-13 19:00 UTC", venue: "Levi's Stadium, Santa Clara",                     group: "B", round: "Matchday 3"  },
  { home: "SUI", away: "BIH", kickoff: "2026-06-18 19:00 UTC", venue: "SoFi Stadium, Los Angeles",                       group: "B", round: "Matchday 8"  },
  { home: "CAN", away: "QAT", kickoff: "2026-06-18 22:00 UTC", venue: "BC Place, Vancouver",                             group: "B", round: "Matchday 8"  },
  { home: "SUI", away: "CAN", kickoff: "2026-06-24 19:00 UTC", venue: "BC Place, Vancouver",                             group: "B", round: "Matchday 14" },
  { home: "BIH", away: "QAT", kickoff: "2026-06-24 19:00 UTC", venue: "Lumen Field, Seattle",                            group: "B", round: "Matchday 14" },
  # ── Group C — Brazil, Morocco, Haiti, Scotland ──
  { home: "BRA", away: "MAR", kickoff: "2026-06-13 22:00 UTC", venue: "MetLife Stadium, East Rutherford",                group: "C", round: "Matchday 3"  },
  { home: "HAI", away: "SCO", kickoff: "2026-06-14 01:00 UTC", venue: "Gillette Stadium, Foxborough",                    group: "C", round: "Matchday 3"  },
  { home: "SCO", away: "MAR", kickoff: "2026-06-19 22:00 UTC", venue: "Gillette Stadium, Foxborough",                    group: "C", round: "Matchday 9"  },
  { home: "BRA", away: "HAI", kickoff: "2026-06-20 00:30 UTC", venue: "Lincoln Financial Field, Philadelphia",           group: "C", round: "Matchday 9"  },
  { home: "SCO", away: "BRA", kickoff: "2026-06-24 22:00 UTC", venue: "Hard Rock Stadium, Miami",                        group: "C", round: "Matchday 14" },
  { home: "MAR", away: "HAI", kickoff: "2026-06-24 22:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",                  group: "C", round: "Matchday 14" },
  # ── Group D — USA, Paraguay, Australia, Turkey ──
  { home: "USA", away: "PAR", kickoff: "2026-06-13 01:00 UTC", venue: "SoFi Stadium, Los Angeles",                       group: "D", round: "Matchday 2"  },
  { home: "AUS", away: "TUR", kickoff: "2026-06-14 04:00 UTC", venue: "BC Place, Vancouver",                             group: "D", round: "Matchday 3"  },
  { home: "USA", away: "AUS", kickoff: "2026-06-19 19:00 UTC", venue: "Lumen Field, Seattle",                            group: "D", round: "Matchday 9"  },
  { home: "TUR", away: "PAR", kickoff: "2026-06-20 03:00 UTC", venue: "Levi's Stadium, Santa Clara",                     group: "D", round: "Matchday 9"  },
  { home: "TUR", away: "USA", kickoff: "2026-06-26 02:00 UTC", venue: "SoFi Stadium, Los Angeles",                       group: "D", round: "Matchday 15" },
  { home: "PAR", away: "AUS", kickoff: "2026-06-26 02:00 UTC", venue: "Levi's Stadium, Santa Clara",                     group: "D", round: "Matchday 15" },
  # ── Group E — Germany, Curacao, Ivory Coast, Ecuador ──
  { home: "GER", away: "CUW", kickoff: "2026-06-14 17:00 UTC", venue: "NRG Stadium, Houston",                            group: "E", round: "Matchday 4"  },
  { home: "CIV", away: "ECU", kickoff: "2026-06-14 23:00 UTC", venue: "Lincoln Financial Field, Philadelphia",           group: "E", round: "Matchday 4"  },
  { home: "GER", away: "CIV", kickoff: "2026-06-20 20:00 UTC", venue: "BMO Field, Toronto",                              group: "E", round: "Matchday 10" },
  { home: "ECU", away: "CUW", kickoff: "2026-06-21 00:00 UTC", venue: "Arrowhead Stadium, Kansas City",                  group: "E", round: "Matchday 10" },
  { home: "CUW", away: "CIV", kickoff: "2026-06-25 20:00 UTC", venue: "Lincoln Financial Field, Philadelphia",           group: "E", round: "Matchday 15" },
  { home: "ECU", away: "GER", kickoff: "2026-06-25 20:00 UTC", venue: "MetLife Stadium, East Rutherford",                group: "E", round: "Matchday 15" },
  # ── Group F — Netherlands, Japan, Sweden, Tunisia ──
  { home: "NED", away: "JPN", kickoff: "2026-06-14 20:00 UTC", venue: "AT&T Stadium, Dallas",                            group: "F", round: "Matchday 4"  },
  { home: "SWE", away: "TUN", kickoff: "2026-06-15 02:00 UTC", venue: "Estadio BBVA, Monterrey",                         group: "F", round: "Matchday 4"  },
  { home: "NED", away: "SWE", kickoff: "2026-06-20 17:00 UTC", venue: "NRG Stadium, Houston",                            group: "F", round: "Matchday 10" },
  { home: "TUN", away: "JPN", kickoff: "2026-06-21 04:00 UTC", venue: "Estadio BBVA, Monterrey",                         group: "F", round: "Matchday 10" },
  { home: "JPN", away: "SWE", kickoff: "2026-06-25 23:00 UTC", venue: "AT&T Stadium, Dallas",                            group: "F", round: "Matchday 15" },
  { home: "TUN", away: "NED", kickoff: "2026-06-25 23:00 UTC", venue: "Arrowhead Stadium, Kansas City",                  group: "F", round: "Matchday 15" },
  # ── Group G — Belgium, Egypt, Iran, New Zealand ──
  { home: "BEL", away: "EGY", kickoff: "2026-06-15 19:00 UTC", venue: "Lumen Field, Seattle",                            group: "G", round: "Matchday 5"  },
  { home: "IRN", away: "NZL", kickoff: "2026-06-16 01:00 UTC", venue: "SoFi Stadium, Los Angeles",                       group: "G", round: "Matchday 5"  },
  { home: "BEL", away: "IRN", kickoff: "2026-06-21 19:00 UTC", venue: "SoFi Stadium, Los Angeles",                       group: "G", round: "Matchday 11" },
  { home: "NZL", away: "EGY", kickoff: "2026-06-22 01:00 UTC", venue: "BC Place, Vancouver",                             group: "G", round: "Matchday 11" },
  { home: "EGY", away: "IRN", kickoff: "2026-06-27 03:00 UTC", venue: "Lumen Field, Seattle",                            group: "G", round: "Matchday 16" },
  { home: "NZL", away: "BEL", kickoff: "2026-06-27 03:00 UTC", venue: "BC Place, Vancouver",                             group: "G", round: "Matchday 16" },
  # ── Group H — Spain, Cape Verde, Saudi Arabia, Uruguay ──
  { home: "ESP", away: "CPV", kickoff: "2026-06-15 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",                  group: "H", round: "Matchday 5"  },
  { home: "KSA", away: "URU", kickoff: "2026-06-15 22:00 UTC", venue: "Hard Rock Stadium, Miami",                        group: "H", round: "Matchday 5"  },
  { home: "ESP", away: "KSA", kickoff: "2026-06-21 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",                  group: "H", round: "Matchday 11" },
  { home: "URU", away: "CPV", kickoff: "2026-06-21 22:00 UTC", venue: "Hard Rock Stadium, Miami",                        group: "H", round: "Matchday 11" },
  { home: "CPV", away: "KSA", kickoff: "2026-06-27 00:00 UTC", venue: "NRG Stadium, Houston",                            group: "H", round: "Matchday 16" },
  { home: "URU", away: "ESP", kickoff: "2026-06-27 00:00 UTC", venue: "Estadio Akron, Guadalajara",                      group: "H", round: "Matchday 16" },
  # ── Group I — France, Senegal, Iraq, Norway ──
  { home: "FRA", away: "SEN", kickoff: "2026-06-16 19:00 UTC", venue: "MetLife Stadium, East Rutherford",                group: "I", round: "Matchday 6"  },
  { home: "IRQ", away: "NOR", kickoff: "2026-06-16 22:00 UTC", venue: "Gillette Stadium, Foxborough",                    group: "I", round: "Matchday 6"  },
  { home: "FRA", away: "IRQ", kickoff: "2026-06-22 21:00 UTC", venue: "Lincoln Financial Field, Philadelphia",           group: "I", round: "Matchday 12" },
  { home: "NOR", away: "SEN", kickoff: "2026-06-23 00:00 UTC", venue: "MetLife Stadium, East Rutherford",                group: "I", round: "Matchday 12" },
  { home: "NOR", away: "FRA", kickoff: "2026-06-26 19:00 UTC", venue: "Gillette Stadium, Foxborough",                    group: "I", round: "Matchday 16" },
  { home: "SEN", away: "IRQ", kickoff: "2026-06-26 19:00 UTC", venue: "BMO Field, Toronto",                              group: "I", round: "Matchday 16" },
  # ── Group J — Argentina, Algeria, Austria, Jordan ──
  { home: "ARG", away: "ALG", kickoff: "2026-06-17 01:00 UTC", venue: "Arrowhead Stadium, Kansas City",                  group: "J", round: "Matchday 6"  },
  { home: "AUT", away: "JOR", kickoff: "2026-06-17 04:00 UTC", venue: "Levi's Stadium, Santa Clara",                     group: "J", round: "Matchday 6"  },
  { home: "ARG", away: "AUT", kickoff: "2026-06-22 17:00 UTC", venue: "AT&T Stadium, Dallas",                            group: "J", round: "Matchday 12" },
  { home: "JOR", away: "ALG", kickoff: "2026-06-23 03:00 UTC", venue: "Levi's Stadium, Santa Clara",                     group: "J", round: "Matchday 12" },
  { home: "ALG", away: "AUT", kickoff: "2026-06-28 02:00 UTC", venue: "Arrowhead Stadium, Kansas City",                  group: "J", round: "Matchday 17" },
  { home: "JOR", away: "ARG", kickoff: "2026-06-28 02:00 UTC", venue: "AT&T Stadium, Dallas",                            group: "J", round: "Matchday 17" },
  # ── Group K — Portugal, DR Congo, Uzbekistan, Colombia ──
  { home: "POR", away: "COD", kickoff: "2026-06-17 17:00 UTC", venue: "NRG Stadium, Houston",                            group: "K", round: "Matchday 7"  },
  { home: "UZB", away: "COL", kickoff: "2026-06-18 02:00 UTC", venue: "Estadio Azteca, Mexico City",                     group: "K", round: "Matchday 7"  },
  { home: "POR", away: "UZB", kickoff: "2026-06-23 17:00 UTC", venue: "NRG Stadium, Houston",                            group: "K", round: "Matchday 13" },
  { home: "COL", away: "COD", kickoff: "2026-06-24 02:00 UTC", venue: "Estadio Akron, Guadalajara",                      group: "K", round: "Matchday 13" },
  { home: "COL", away: "POR", kickoff: "2026-06-27 23:30 UTC", venue: "Hard Rock Stadium, Miami",                        group: "K", round: "Matchday 17" },
  { home: "COD", away: "UZB", kickoff: "2026-06-27 23:30 UTC", venue: "Mercedes-Benz Stadium, Atlanta",                  group: "K", round: "Matchday 17" },
  # ── Group L — England, Croatia, Ghana, Panama ──
  { home: "ENG", away: "CRO", kickoff: "2026-06-17 20:00 UTC", venue: "AT&T Stadium, Dallas",                            group: "L", round: "Matchday 7"  },
  { home: "GHA", away: "PAN", kickoff: "2026-06-17 23:00 UTC", venue: "BMO Field, Toronto",                              group: "L", round: "Matchday 7"  },
  { home: "ENG", away: "GHA", kickoff: "2026-06-23 20:00 UTC", venue: "Gillette Stadium, Foxborough",                    group: "L", round: "Matchday 13" },
  { home: "PAN", away: "CRO", kickoff: "2026-06-23 23:00 UTC", venue: "BMO Field, Toronto",                              group: "L", round: "Matchday 13" },
  { home: "PAN", away: "ENG", kickoff: "2026-06-27 21:00 UTC", venue: "MetLife Stadium, East Rutherford",                group: "L", round: "Matchday 17" },
  { home: "CRO", away: "GHA", kickoff: "2026-06-27 21:00 UTC", venue: "Lincoln Financial Field, Philadelphia",           group: "L", round: "Matchday 17" }
].freeze

WC_FIXTURES.each do |f|
  home = Team.find_by!(code: f[:home])
  away = Team.find_by!(code: f[:away])

  match = Match.find_or_initialize_by(home_team: home, away_team: away, competition: wc_comp)
  match.update!(
    kickoff_at:  DateTime.parse(f[:kickoff]),
    venue:       f[:venue],
    group_stage: f[:group],
    round:       f[:round],
    status:      "scheduled",
    home_score:  nil,
    away_score:  nil
  )
end

# Knockout bracket — fixtures start as TBD slots and auto-populate from group
# results / earlier-round winners (see WorldCupKnockout).
WorldCupKnockout.new(competition: wc_comp).ensure_fixtures!
WorldCupKnockout.rebuild!

puts "#{Match.where(competition: wc_comp).where.not(group_stage: nil).count} WC group matches seeded"
puts "#{Match.where(competition: wc_comp, group_stage: nil).count} WC knockout fixtures seeded"
puts "#{Match.count} total matches"
puts "Done! ✓"
