class CleanupFakeDataAndReseedWc < ActiveRecord::Migration[8.1]
  WC_CODES = %w[
    MEX RSA KOR CZE CAN BIH QAT SUI BRA MAR HAI SCO
    USA PAR AUS TUR GER CUW CIV ECU NED JPN SWE TUN
    BEL EGY IRN NZL ESP CPV KSA URU FRA SEN IRQ NOR
    ARG ALG AUT JOR POR COD UZB COL ENG CRO GHA PAN
  ].freeze

  CLUB_CODES = %w[
    ARS MCI LIV CHE TOT MUN NEW AVL BHA WHU
    RMA BAR ATM SEV RSO ATH VIL VAL
    BAY BVB RBL B04 SGE WOB
    INT ACM JUV ROM NAP LAZ ATL FIO
    PSG MON OLM OLY LIL NIC
    LAF MIA TIM SEA NYC ATU
  ].freeze

  WC_TEAMS = [
    { name: "Mexico",         code: "MEX", group: "A", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/mx.png"     },
    { name: "South Africa",   code: "RSA", group: "A", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/za.png"     },
    { name: "South Korea",    code: "KOR", group: "A", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/kr.png"     },
    { name: "Czechia",        code: "CZE", group: "A", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/cz.png"     },
    { name: "Canada",         code: "CAN", group: "B", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/ca.png"     },
    { name: "Bosnia & Herz.", code: "BIH", group: "B", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/ba.png"     },
    { name: "Qatar",          code: "QAT", group: "B", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/qa.png"     },
    { name: "Switzerland",    code: "SUI", group: "B", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/ch.png"     },
    { name: "Brazil",         code: "BRA", group: "C", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/br.png"     },
    { name: "Morocco",        code: "MAR", group: "C", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/ma.png"     },
    { name: "Haiti",          code: "HAI", group: "C", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/ht.png"     },
    { name: "Scotland",       code: "SCO", group: "C", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/gb-sct.png" },
    { name: "United States",  code: "USA", group: "D", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/us.png"     },
    { name: "Paraguay",       code: "PAR", group: "D", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/py.png"     },
    { name: "Australia",      code: "AUS", group: "D", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/au.png"     },
    { name: "Turkey",         code: "TUR", group: "D", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/tr.png"     },
    { name: "Germany",        code: "GER", group: "E", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/de.png"     },
    { name: "Curacao",        code: "CUW", group: "E", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/cw.png"     },
    { name: "Ivory Coast",    code: "CIV", group: "E", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/ci.png"     },
    { name: "Ecuador",        code: "ECU", group: "E", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ec.png"     },
    { name: "Netherlands",    code: "NED", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/nl.png"     },
    { name: "Japan",          code: "JPN", group: "F", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/jp.png"     },
    { name: "Sweden",         code: "SWE", group: "F", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/se.png"     },
    { name: "Tunisia",        code: "TUN", group: "F", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/tn.png"     },
    { name: "Belgium",        code: "BEL", group: "G", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/be.png"     },
    { name: "Egypt",          code: "EGY", group: "G", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/eg.png"     },
    { name: "Iran",           code: "IRN", group: "G", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/ir.png"     },
    { name: "New Zealand",    code: "NZL", group: "G", confederation: "OFC",      flag_url: "https://flagcdn.com/w80/nz.png"     },
    { name: "Spain",          code: "ESP", group: "H", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/es.png"     },
    { name: "Cape Verde",     code: "CPV", group: "H", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cv.png"     },
    { name: "Saudi Arabia",   code: "KSA", group: "H", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/sa.png"     },
    { name: "Uruguay",        code: "URU", group: "H", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/uy.png"     },
    { name: "France",         code: "FRA", group: "I", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/fr.png"     },
    { name: "Senegal",        code: "SEN", group: "I", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/sn.png"     },
    { name: "Iraq",           code: "IRQ", group: "I", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/iq.png"     },
    { name: "Norway",         code: "NOR", group: "I", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/no.png"     },
    { name: "Argentina",      code: "ARG", group: "J", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/ar.png"     },
    { name: "Algeria",        code: "ALG", group: "J", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/dz.png"     },
    { name: "Austria",        code: "AUT", group: "J", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/at.png"     },
    { name: "Jordan",         code: "JOR", group: "J", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/jo.png"     },
    { name: "Portugal",       code: "POR", group: "K", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/pt.png"     },
    { name: "DR Congo",       code: "COD", group: "K", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/cd.png"     },
    { name: "Uzbekistan",     code: "UZB", group: "K", confederation: "AFC",      flag_url: "https://flagcdn.com/w80/uz.png"     },
    { name: "Colombia",       code: "COL", group: "K", confederation: "CONMEBOL", flag_url: "https://flagcdn.com/w80/co.png"     },
    { name: "England",        code: "ENG", group: "L", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/gb-eng.png" },
    { name: "Croatia",        code: "CRO", group: "L", confederation: "UEFA",     flag_url: "https://flagcdn.com/w80/hr.png"     },
    { name: "Ghana",          code: "GHA", group: "L", confederation: "CAF",      flag_url: "https://flagcdn.com/w80/gh.png"     },
    { name: "Panama",         code: "PAN", group: "L", confederation: "CONCACAF", flag_url: "https://flagcdn.com/w80/pa.png"     },
  ].freeze

  WC_FIXTURES = [
    { home: "MEX", away: "RSA", kickoff: "2026-06-11 23:00 UTC", venue: "Estadio GNP Seguros, Mexico City",      group: "A" },
    { home: "KOR", away: "CZE", kickoff: "2026-06-12 02:00 UTC", venue: "Estadio Akron, Guadalajara",            group: "A" },
    { home: "MEX", away: "KOR", kickoff: "2026-06-15 23:00 UTC", venue: "Estadio GNP Seguros, Mexico City",      group: "A" },
    { home: "CZE", away: "RSA", kickoff: "2026-06-15 19:00 UTC", venue: "Estadio Akron, Guadalajara",            group: "A" },
    { home: "MEX", away: "CZE", kickoff: "2026-06-19 23:00 UTC", venue: "Estadio GNP Seguros, Mexico City",      group: "A" },
    { home: "RSA", away: "KOR", kickoff: "2026-06-19 23:00 UTC", venue: "Estadio Akron, Guadalajara",            group: "A" },
    { home: "CAN", away: "BIH", kickoff: "2026-06-12 23:00 UTC", venue: "BC Place, Vancouver",                   group: "B" },
    { home: "QAT", away: "SUI", kickoff: "2026-06-12 19:00 UTC", venue: "BMO Field, Toronto",                    group: "B" },
    { home: "CAN", away: "QAT", kickoff: "2026-06-16 23:00 UTC", venue: "BC Place, Vancouver",                   group: "B" },
    { home: "SUI", away: "BIH", kickoff: "2026-06-16 19:00 UTC", venue: "BMO Field, Toronto",                    group: "B" },
    { home: "CAN", away: "SUI", kickoff: "2026-06-20 23:00 UTC", venue: "BC Place, Vancouver",                   group: "B" },
    { home: "BIH", away: "QAT", kickoff: "2026-06-20 23:00 UTC", venue: "BMO Field, Toronto",                    group: "B" },
    { home: "BRA", away: "MAR", kickoff: "2026-06-13 02:00 UTC", venue: "SoFi Stadium, Los Angeles",             group: "C" },
    { home: "HAI", away: "SCO", kickoff: "2026-06-13 22:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "C" },
    { home: "BRA", away: "HAI", kickoff: "2026-06-17 22:00 UTC", venue: "SoFi Stadium, Los Angeles",             group: "C" },
    { home: "SCO", away: "MAR", kickoff: "2026-06-17 02:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "C" },
    { home: "BRA", away: "SCO", kickoff: "2026-06-21 22:00 UTC", venue: "SoFi Stadium, Los Angeles",             group: "C" },
    { home: "MAR", away: "HAI", kickoff: "2026-06-21 22:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "C" },
    { home: "USA", away: "PAR", kickoff: "2026-06-12 02:00 UTC", venue: "AT&T Stadium, Dallas",                  group: "D" },
    { home: "AUS", away: "TUR", kickoff: "2026-06-12 19:00 UTC", venue: "NRG Stadium, Houston",                  group: "D" },
    { home: "USA", away: "AUS", kickoff: "2026-06-16 02:00 UTC", venue: "AT&T Stadium, Dallas",                  group: "D" },
    { home: "TUR", away: "PAR", kickoff: "2026-06-16 22:00 UTC", venue: "NRG Stadium, Houston",                  group: "D" },
    { home: "USA", away: "TUR", kickoff: "2026-06-20 02:00 UTC", venue: "AT&T Stadium, Dallas",                  group: "D" },
    { home: "PAR", away: "AUS", kickoff: "2026-06-20 22:00 UTC", venue: "NRG Stadium, Houston",                  group: "D" },
    { home: "GER", away: "CUW", kickoff: "2026-06-13 22:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "E" },
    { home: "CIV", away: "ECU", kickoff: "2026-06-13 19:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "E" },
    { home: "GER", away: "CIV", kickoff: "2026-06-17 19:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "E" },
    { home: "ECU", away: "CUW", kickoff: "2026-06-17 22:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "E" },
    { home: "GER", away: "ECU", kickoff: "2026-06-21 19:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "E" },
    { home: "CUW", away: "CIV", kickoff: "2026-06-21 19:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "E" },
    { home: "NED", away: "JPN", kickoff: "2026-06-14 02:00 UTC", venue: "Lumen Field, Seattle",                  group: "F" },
    { home: "SWE", away: "TUN", kickoff: "2026-06-14 22:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "F" },
    { home: "NED", away: "SWE", kickoff: "2026-06-18 02:00 UTC", venue: "Lumen Field, Seattle",                  group: "F" },
    { home: "TUN", away: "JPN", kickoff: "2026-06-18 22:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "F" },
    { home: "NED", away: "TUN", kickoff: "2026-06-22 02:00 UTC", venue: "Lumen Field, Seattle",                  group: "F" },
    { home: "JPN", away: "SWE", kickoff: "2026-06-22 02:00 UTC", venue: "Levi's Stadium, San Francisco",         group: "F" },
    { home: "BEL", away: "EGY", kickoff: "2026-06-14 22:00 UTC", venue: "Arrowhead Stadium, Kansas City",        group: "G" },
    { home: "IRN", away: "NZL", kickoff: "2026-06-14 19:00 UTC", venue: "Paycor Stadium, Cincinnati",            group: "G" },
    { home: "BEL", away: "IRN", kickoff: "2026-06-18 22:00 UTC", venue: "Arrowhead Stadium, Kansas City",        group: "G" },
    { home: "NZL", away: "EGY", kickoff: "2026-06-18 19:00 UTC", venue: "Paycor Stadium, Cincinnati",            group: "G" },
    { home: "BEL", away: "NZL", kickoff: "2026-06-22 22:00 UTC", venue: "Arrowhead Stadium, Kansas City",        group: "G" },
    { home: "EGY", away: "IRN", kickoff: "2026-06-22 22:00 UTC", venue: "Paycor Stadium, Cincinnati",            group: "G" },
    { home: "ESP", away: "CPV", kickoff: "2026-06-15 02:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "H" },
    { home: "KSA", away: "URU", kickoff: "2026-06-15 22:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "H" },
    { home: "ESP", away: "KSA", kickoff: "2026-06-19 02:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "H" },
    { home: "URU", away: "CPV", kickoff: "2026-06-19 22:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "H" },
    { home: "ESP", away: "URU", kickoff: "2026-06-23 02:00 UTC", venue: "Hard Rock Stadium, Miami",              group: "H" },
    { home: "CPV", away: "KSA", kickoff: "2026-06-23 02:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",        group: "H" },
    { home: "FRA", away: "SEN", kickoff: "2026-06-15 22:00 UTC", venue: "Soldier Field, Chicago",                group: "I" },
    { home: "IRQ", away: "NOR", kickoff: "2026-06-15 19:00 UTC", venue: "Gillette Stadium, Boston",              group: "I" },
    { home: "FRA", away: "IRQ", kickoff: "2026-06-19 22:00 UTC", venue: "Soldier Field, Chicago",                group: "I" },
    { home: "NOR", away: "SEN", kickoff: "2026-06-19 19:00 UTC", venue: "Gillette Stadium, Boston",              group: "I" },
    { home: "FRA", away: "NOR", kickoff: "2026-06-23 22:00 UTC", venue: "Soldier Field, Chicago",                group: "I" },
    { home: "SEN", away: "IRQ", kickoff: "2026-06-23 22:00 UTC", venue: "Gillette Stadium, Boston",              group: "I" },
    { home: "ARG", away: "ALG", kickoff: "2026-06-16 02:00 UTC", venue: "MetLife Stadium, New York",             group: "J" },
    { home: "AUT", away: "JOR", kickoff: "2026-06-16 22:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "J" },
    { home: "ARG", away: "AUT", kickoff: "2026-06-20 02:00 UTC", venue: "MetLife Stadium, New York",             group: "J" },
    { home: "JOR", away: "ALG", kickoff: "2026-06-20 22:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "J" },
    { home: "ARG", away: "JOR", kickoff: "2026-06-24 02:00 UTC", venue: "MetLife Stadium, New York",             group: "J" },
    { home: "ALG", away: "AUT", kickoff: "2026-06-24 02:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "J" },
    { home: "POR", away: "COD", kickoff: "2026-06-17 02:00 UTC", venue: "Rose Bowl, Los Angeles",                group: "K" },
    { home: "UZB", away: "COL", kickoff: "2026-06-17 22:00 UTC", venue: "Dignity Health Sports Park, LA",        group: "K" },
    { home: "POR", away: "UZB", kickoff: "2026-06-21 02:00 UTC", venue: "Rose Bowl, Los Angeles",                group: "K" },
    { home: "COL", away: "COD", kickoff: "2026-06-21 22:00 UTC", venue: "Dignity Health Sports Park, LA",        group: "K" },
    { home: "POR", away: "COL", kickoff: "2026-06-25 02:00 UTC", venue: "Rose Bowl, Los Angeles",                group: "K" },
    { home: "COD", away: "UZB", kickoff: "2026-06-25 02:00 UTC", venue: "Dignity Health Sports Park, LA",        group: "K" },
    { home: "ENG", away: "CRO", kickoff: "2026-06-17 19:00 UTC", venue: "Gillette Stadium, Boston",              group: "L" },
    { home: "GHA", away: "PAN", kickoff: "2026-06-17 22:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "L" },
    { home: "ENG", away: "GHA", kickoff: "2026-06-21 19:00 UTC", venue: "Gillette Stadium, Boston",              group: "L" },
    { home: "PAN", away: "CRO", kickoff: "2026-06-21 22:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "L" },
    { home: "ENG", away: "PAN", kickoff: "2026-06-25 19:00 UTC", venue: "Gillette Stadium, Boston",              group: "L" },
    { home: "CRO", away: "GHA", kickoff: "2026-06-25 19:00 UTC", venue: "Lincoln Financial Field, Philadelphia", group: "L" },
  ].freeze

  def up
    wc_id = execute("SELECT id FROM competitions WHERE code = 'WC' LIMIT 1").first&.fetch("id", nil)
    return unless wc_id

    # 1. Remove Copa América 2026
    ca_id = execute("SELECT id FROM competitions WHERE code = 'CA' LIMIT 1").first&.fetch("id", nil)
    if ca_id
      execute("DELETE FROM matches WHERE competition_id = #{ca_id}")
      execute("DELETE FROM standings WHERE competition_id = #{ca_id}")
      execute("DELETE FROM competitions WHERE id = #{ca_id}")
    end

    # 2. Remove all non-WC matches
    execute("DELETE FROM goals WHERE match_id IN (SELECT id FROM matches WHERE competition_id != #{wc_id})")
    execute("DELETE FROM match_stats WHERE match_id IN (SELECT id FROM matches WHERE competition_id != #{wc_id})")
    execute("DELETE FROM matches WHERE competition_id != #{wc_id}")

    # 3. Remove orphan placeholder teams (not WC, not a known club)
    keep = (WC_CODES + CLUB_CODES).map { |c| quote(c) }.join(", ")
    execute("UPDATE teams SET \"group\" = NULL WHERE code NOT IN (#{keep})")
    execute("DELETE FROM teams WHERE code NOT IN (#{keep})")

    # 4. Upsert WC teams with correct groups
    WC_TEAMS.each do |t|
      existing = execute("SELECT id FROM teams WHERE code = #{quote(t[:code])} LIMIT 1").first
      if existing
        execute(<<~SQL)
          UPDATE teams SET
            name = #{quote(t[:name])},
            "group" = #{quote(t[:group])},
            confederation = #{quote(t[:confederation])},
            flag_url = #{quote(t[:flag_url])},
            updated_at = NOW()
          WHERE code = #{quote(t[:code])}
        SQL
      else
        execute(<<~SQL)
          INSERT INTO teams (name, code, "group", confederation, flag_url, created_at, updated_at)
          VALUES (#{quote(t[:name])}, #{quote(t[:code])}, #{quote(t[:group])}, #{quote(t[:confederation])}, #{quote(t[:flag_url])}, NOW(), NOW())
        SQL
      end
    end

    # 5. Upsert all 72 WC group stage fixtures (preserve scores/status if already recorded)
    WC_FIXTURES.each do |f|
      home_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:home])} LIMIT 1").first&.fetch("id", nil)
      away_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:away])} LIMIT 1").first&.fetch("id", nil)
      next unless home_id && away_id

      existing = execute(<<~SQL).first
        SELECT id FROM matches
        WHERE home_team_id = #{home_id} AND away_team_id = #{away_id} AND competition_id = #{wc_id}
        LIMIT 1
      SQL

      if existing
        execute(<<~SQL)
          UPDATE matches SET
            kickoff_at = #{quote(f[:kickoff])},
            venue = #{quote(f[:venue])},
            group_stage = #{quote(f[:group])},
            round = 'Group Stage',
            updated_at = NOW()
          WHERE id = #{existing.fetch("id")}
        SQL
      else
        execute(<<~SQL)
          INSERT INTO matches (home_team_id, away_team_id, competition_id, kickoff_at, venue, group_stage, round, status, created_at, updated_at)
          VALUES (#{home_id}, #{away_id}, #{wc_id}, #{quote(f[:kickoff])}, #{quote(f[:venue])}, #{quote(f[:group])}, 'Group Stage', 'scheduled', NOW(), NOW())
        SQL
      end
    end

    # 6. Delete any remaining WC matches with wrong team pairings
    valid_ids = WC_FIXTURES.filter_map do |f|
      home_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:home])} LIMIT 1").first&.fetch("id", nil)
      away_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:away])} LIMIT 1").first&.fetch("id", nil)
      next unless home_id && away_id
      execute(<<~SQL).first&.fetch("id", nil)
        SELECT id FROM matches WHERE home_team_id = #{home_id} AND away_team_id = #{away_id} AND competition_id = #{wc_id} LIMIT 1
      SQL
    end.compact

    if valid_ids.any?
      execute("DELETE FROM matches WHERE competition_id = #{wc_id} AND id NOT IN (#{valid_ids.join(', ')})")
    end
  end

  def down; end

  private

  def quote(val)
    val.nil? ? "NULL" : ActiveRecord::Base.connection.quote(val)
  end
end
