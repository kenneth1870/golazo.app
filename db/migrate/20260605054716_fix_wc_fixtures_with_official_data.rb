class FixWcFixturesWithOfficialData < ActiveRecord::Migration[8.1]
  # Official FIFA WC 2026 fixtures — all kickoffs in UTC, venues confirmed.
  # Source: official schedule + stadium list (June 2026).
  FIXTURES = [
    # Group A
    { home: "MEX", away: "RSA", kickoff: "2026-06-11 19:00 UTC", venue: "Estadio Azteca, Mexico City",              group: "A", round: "Matchday 1"  },
    { home: "KOR", away: "CZE", kickoff: "2026-06-12 02:00 UTC", venue: "Estadio Akron, Guadalajara",               group: "A", round: "Matchday 1"  },
    { home: "CZE", away: "RSA", kickoff: "2026-06-18 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",           group: "A", round: "Matchday 8"  },
    { home: "MEX", away: "KOR", kickoff: "2026-06-19 01:00 UTC", venue: "Estadio Akron, Guadalajara",               group: "A", round: "Matchday 8"  },
    { home: "CZE", away: "MEX", kickoff: "2026-06-25 01:00 UTC", venue: "Estadio Azteca, Mexico City",              group: "A", round: "Matchday 14" },
    { home: "RSA", away: "KOR", kickoff: "2026-06-25 01:00 UTC", venue: "Estadio BBVA, Monterrey",                  group: "A", round: "Matchday 14" },
    # Group B
    { home: "CAN", away: "BIH", kickoff: "2026-06-12 19:00 UTC", venue: "BMO Field, Toronto",                       group: "B", round: "Matchday 2"  },
    { home: "QAT", away: "SUI", kickoff: "2026-06-13 19:00 UTC", venue: "Levi's Stadium, Santa Clara",              group: "B", round: "Matchday 3"  },
    { home: "SUI", away: "BIH", kickoff: "2026-06-18 19:00 UTC", venue: "SoFi Stadium, Los Angeles",                group: "B", round: "Matchday 8"  },
    { home: "CAN", away: "QAT", kickoff: "2026-06-18 22:00 UTC", venue: "BC Place, Vancouver",                      group: "B", round: "Matchday 8"  },
    { home: "SUI", away: "CAN", kickoff: "2026-06-24 19:00 UTC", venue: "BC Place, Vancouver",                      group: "B", round: "Matchday 14" },
    { home: "BIH", away: "QAT", kickoff: "2026-06-24 19:00 UTC", venue: "Lumen Field, Seattle",                     group: "B", round: "Matchday 14" },
    # Group C
    { home: "BRA", away: "MAR", kickoff: "2026-06-13 22:00 UTC", venue: "MetLife Stadium, East Rutherford",         group: "C", round: "Matchday 3"  },
    { home: "HAI", away: "SCO", kickoff: "2026-06-14 01:00 UTC", venue: "Gillette Stadium, Foxborough",             group: "C", round: "Matchday 3"  },
    { home: "SCO", away: "MAR", kickoff: "2026-06-19 22:00 UTC", venue: "Gillette Stadium, Foxborough",             group: "C", round: "Matchday 9"  },
    { home: "BRA", away: "HAI", kickoff: "2026-06-20 00:30 UTC", venue: "Lincoln Financial Field, Philadelphia",    group: "C", round: "Matchday 9"  },
    { home: "SCO", away: "BRA", kickoff: "2026-06-24 22:00 UTC", venue: "Hard Rock Stadium, Miami",                 group: "C", round: "Matchday 14" },
    { home: "MAR", away: "HAI", kickoff: "2026-06-24 22:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",           group: "C", round: "Matchday 14" },
    # Group D
    { home: "USA", away: "PAR", kickoff: "2026-06-13 01:00 UTC", venue: "SoFi Stadium, Los Angeles",                group: "D", round: "Matchday 2"  },
    { home: "AUS", away: "TUR", kickoff: "2026-06-14 04:00 UTC", venue: "BC Place, Vancouver",                      group: "D", round: "Matchday 3"  },
    { home: "USA", away: "AUS", kickoff: "2026-06-19 19:00 UTC", venue: "Lumen Field, Seattle",                     group: "D", round: "Matchday 9"  },
    { home: "TUR", away: "PAR", kickoff: "2026-06-20 03:00 UTC", venue: "Levi's Stadium, Santa Clara",              group: "D", round: "Matchday 9"  },
    { home: "TUR", away: "USA", kickoff: "2026-06-26 02:00 UTC", venue: "SoFi Stadium, Los Angeles",                group: "D", round: "Matchday 15" },
    { home: "PAR", away: "AUS", kickoff: "2026-06-26 02:00 UTC", venue: "Levi's Stadium, Santa Clara",              group: "D", round: "Matchday 15" },
    # Group E
    { home: "GER", away: "CUW", kickoff: "2026-06-14 17:00 UTC", venue: "NRG Stadium, Houston",                     group: "E", round: "Matchday 4"  },
    { home: "CIV", away: "ECU", kickoff: "2026-06-14 23:00 UTC", venue: "Lincoln Financial Field, Philadelphia",    group: "E", round: "Matchday 4"  },
    { home: "GER", away: "CIV", kickoff: "2026-06-20 20:00 UTC", venue: "BMO Field, Toronto",                       group: "E", round: "Matchday 10" },
    { home: "ECU", away: "CUW", kickoff: "2026-06-21 00:00 UTC", venue: "Arrowhead Stadium, Kansas City",           group: "E", round: "Matchday 10" },
    { home: "CUW", away: "CIV", kickoff: "2026-06-25 20:00 UTC", venue: "Lincoln Financial Field, Philadelphia",    group: "E", round: "Matchday 15" },
    { home: "ECU", away: "GER", kickoff: "2026-06-25 20:00 UTC", venue: "MetLife Stadium, East Rutherford",         group: "E", round: "Matchday 15" },
    # Group F
    { home: "NED", away: "JPN", kickoff: "2026-06-14 20:00 UTC", venue: "AT&T Stadium, Dallas",                     group: "F", round: "Matchday 4"  },
    { home: "SWE", away: "TUN", kickoff: "2026-06-15 02:00 UTC", venue: "Estadio BBVA, Monterrey",                  group: "F", round: "Matchday 4"  },
    { home: "NED", away: "SWE", kickoff: "2026-06-20 17:00 UTC", venue: "NRG Stadium, Houston",                     group: "F", round: "Matchday 10" },
    { home: "TUN", away: "JPN", kickoff: "2026-06-21 04:00 UTC", venue: "Estadio BBVA, Monterrey",                  group: "F", round: "Matchday 10" },
    { home: "JPN", away: "SWE", kickoff: "2026-06-25 23:00 UTC", venue: "AT&T Stadium, Dallas",                     group: "F", round: "Matchday 15" },
    { home: "TUN", away: "NED", kickoff: "2026-06-25 23:00 UTC", venue: "Arrowhead Stadium, Kansas City",           group: "F", round: "Matchday 15" },
    # Group G
    { home: "BEL", away: "EGY", kickoff: "2026-06-15 19:00 UTC", venue: "Lumen Field, Seattle",                     group: "G", round: "Matchday 5"  },
    { home: "IRN", away: "NZL", kickoff: "2026-06-16 01:00 UTC", venue: "SoFi Stadium, Los Angeles",                group: "G", round: "Matchday 5"  },
    { home: "BEL", away: "IRN", kickoff: "2026-06-21 19:00 UTC", venue: "SoFi Stadium, Los Angeles",                group: "G", round: "Matchday 11" },
    { home: "NZL", away: "EGY", kickoff: "2026-06-22 01:00 UTC", venue: "BC Place, Vancouver",                      group: "G", round: "Matchday 11" },
    { home: "EGY", away: "IRN", kickoff: "2026-06-27 03:00 UTC", venue: "Lumen Field, Seattle",                     group: "G", round: "Matchday 16" },
    { home: "NZL", away: "BEL", kickoff: "2026-06-27 03:00 UTC", venue: "BC Place, Vancouver",                      group: "G", round: "Matchday 16" },
    # Group H
    { home: "ESP", away: "CPV", kickoff: "2026-06-15 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",           group: "H", round: "Matchday 5"  },
    { home: "KSA", away: "URU", kickoff: "2026-06-15 22:00 UTC", venue: "Hard Rock Stadium, Miami",                 group: "H", round: "Matchday 5"  },
    { home: "ESP", away: "KSA", kickoff: "2026-06-21 16:00 UTC", venue: "Mercedes-Benz Stadium, Atlanta",           group: "H", round: "Matchday 11" },
    { home: "URU", away: "CPV", kickoff: "2026-06-21 22:00 UTC", venue: "Hard Rock Stadium, Miami",                 group: "H", round: "Matchday 11" },
    { home: "CPV", away: "KSA", kickoff: "2026-06-27 00:00 UTC", venue: "NRG Stadium, Houston",                     group: "H", round: "Matchday 16" },
    { home: "URU", away: "ESP", kickoff: "2026-06-27 00:00 UTC", venue: "Estadio Akron, Guadalajara",               group: "H", round: "Matchday 16" },
    # Group I
    { home: "FRA", away: "SEN", kickoff: "2026-06-16 19:00 UTC", venue: "MetLife Stadium, East Rutherford",         group: "I", round: "Matchday 6"  },
    { home: "IRQ", away: "NOR", kickoff: "2026-06-16 22:00 UTC", venue: "Gillette Stadium, Foxborough",             group: "I", round: "Matchday 6"  },
    { home: "FRA", away: "IRQ", kickoff: "2026-06-22 21:00 UTC", venue: "Lincoln Financial Field, Philadelphia",    group: "I", round: "Matchday 12" },
    { home: "NOR", away: "SEN", kickoff: "2026-06-23 00:00 UTC", venue: "MetLife Stadium, East Rutherford",         group: "I", round: "Matchday 12" },
    { home: "NOR", away: "FRA", kickoff: "2026-06-26 19:00 UTC", venue: "Gillette Stadium, Foxborough",             group: "I", round: "Matchday 16" },
    { home: "SEN", away: "IRQ", kickoff: "2026-06-26 19:00 UTC", venue: "BMO Field, Toronto",                       group: "I", round: "Matchday 16" },
    # Group J
    { home: "ARG", away: "ALG", kickoff: "2026-06-17 01:00 UTC", venue: "Arrowhead Stadium, Kansas City",           group: "J", round: "Matchday 6"  },
    { home: "AUT", away: "JOR", kickoff: "2026-06-17 04:00 UTC", venue: "Levi's Stadium, Santa Clara",              group: "J", round: "Matchday 6"  },
    { home: "ARG", away: "AUT", kickoff: "2026-06-22 17:00 UTC", venue: "AT&T Stadium, Dallas",                     group: "J", round: "Matchday 12" },
    { home: "JOR", away: "ALG", kickoff: "2026-06-23 03:00 UTC", venue: "Levi's Stadium, Santa Clara",              group: "J", round: "Matchday 12" },
    { home: "ALG", away: "AUT", kickoff: "2026-06-28 02:00 UTC", venue: "Arrowhead Stadium, Kansas City",           group: "J", round: "Matchday 17" },
    { home: "JOR", away: "ARG", kickoff: "2026-06-28 02:00 UTC", venue: "AT&T Stadium, Dallas",                     group: "J", round: "Matchday 17" },
    # Group K
    { home: "POR", away: "COD", kickoff: "2026-06-17 17:00 UTC", venue: "NRG Stadium, Houston",                     group: "K", round: "Matchday 7"  },
    { home: "UZB", away: "COL", kickoff: "2026-06-18 02:00 UTC", venue: "Estadio Azteca, Mexico City",              group: "K", round: "Matchday 7"  },
    { home: "POR", away: "UZB", kickoff: "2026-06-23 17:00 UTC", venue: "NRG Stadium, Houston",                     group: "K", round: "Matchday 13" },
    { home: "COL", away: "COD", kickoff: "2026-06-24 02:00 UTC", venue: "Estadio Akron, Guadalajara",               group: "K", round: "Matchday 13" },
    { home: "COL", away: "POR", kickoff: "2026-06-27 23:30 UTC", venue: "Hard Rock Stadium, Miami",                 group: "K", round: "Matchday 17" },
    { home: "COD", away: "UZB", kickoff: "2026-06-27 23:30 UTC", venue: "Mercedes-Benz Stadium, Atlanta",          group: "K", round: "Matchday 17" },
    # Group L
    { home: "ENG", away: "CRO", kickoff: "2026-06-17 20:00 UTC", venue: "AT&T Stadium, Dallas",                     group: "L", round: "Matchday 7"  },
    { home: "GHA", away: "PAN", kickoff: "2026-06-17 23:00 UTC", venue: "BMO Field, Toronto",                       group: "L", round: "Matchday 7"  },
    { home: "ENG", away: "GHA", kickoff: "2026-06-23 20:00 UTC", venue: "Gillette Stadium, Foxborough",             group: "L", round: "Matchday 13" },
    { home: "PAN", away: "CRO", kickoff: "2026-06-23 23:00 UTC", venue: "BMO Field, Toronto",                       group: "L", round: "Matchday 13" },
    { home: "PAN", away: "ENG", kickoff: "2026-06-27 21:00 UTC", venue: "MetLife Stadium, East Rutherford",         group: "L", round: "Matchday 17" },
    { home: "CRO", away: "GHA", kickoff: "2026-06-27 21:00 UTC", venue: "Lincoln Financial Field, Philadelphia",    group: "L", round: "Matchday 17" }
  ].freeze

  def up
    wc_id = execute("SELECT id FROM competitions WHERE code = 'WC' LIMIT 1").first&.fetch("id", nil)
    return unless wc_id

    FIXTURES.each do |f|
      home_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:home])} LIMIT 1").first&.fetch("id", nil)
      away_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:away])} LIMIT 1").first&.fetch("id", nil)
      next unless home_id && away_id

      existing = execute(<<~SQL).first
        SELECT id, status FROM matches
        WHERE home_team_id = #{home_id} AND away_team_id = #{away_id} AND competition_id = #{wc_id}
        LIMIT 1
      SQL

      if existing
        # Preserve status/scores if match already has results
        execute(<<~SQL)
          UPDATE matches SET
            kickoff_at  = #{quote(f[:kickoff])},
            venue       = #{quote(f[:venue])},
            group_stage = #{quote(f[:group])},
            round       = #{quote(f[:round])},
            updated_at  = NOW()
          WHERE id = #{existing.fetch("id")}
        SQL
      else
        execute(<<~SQL)
          INSERT INTO matches (home_team_id, away_team_id, competition_id, kickoff_at, venue, group_stage, round, status, created_at, updated_at)
          VALUES (#{home_id}, #{away_id}, #{wc_id}, #{quote(f[:kickoff])}, #{quote(f[:venue])}, #{quote(f[:group])}, #{quote(f[:round])}, 'scheduled', NOW(), NOW())
        SQL
      end
    end

    # Remove any WC group stage matches not in the official 72
    valid_ids = FIXTURES.filter_map do |f|
      home_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:home])} LIMIT 1").first&.fetch("id", nil)
      away_id = execute("SELECT id FROM teams WHERE code = #{quote(f[:away])} LIMIT 1").first&.fetch("id", nil)
      next unless home_id && away_id
      execute("SELECT id FROM matches WHERE home_team_id=#{home_id} AND away_team_id=#{away_id} AND competition_id=#{wc_id} LIMIT 1").first&.fetch("id", nil)
    end.compact

    if valid_ids.any?
      execute("DELETE FROM matches WHERE competition_id=#{wc_id} AND group_stage IS NOT NULL AND id NOT IN (#{valid_ids.join(',')})")
    end
  end

  def down; end

  private

  def quote(val)
    val.nil? ? "NULL" : ActiveRecord::Base.connection.quote(val)
  end
end
