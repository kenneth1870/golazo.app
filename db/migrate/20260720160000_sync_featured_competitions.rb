class SyncFeaturedCompetitions < ActiveRecord::Migration[8.0]
  COMPETITIONS = [
    { code: "PL",  name: "Premier League",        country: "England",    type: "league", logo: "https://crests.football-data.org/PL.png",  ext: 39  },
    { code: "LAL", name: "La Liga",               country: "Spain",      type: "league", logo: "https://crests.football-data.org/PD.png",  ext: 140 },
    { code: "BL1", name: "Bundesliga",            country: "Germany",    type: "league", logo: "https://crests.football-data.org/BL1.png", ext: 78  },
    { code: "SA",  name: "Serie A",               country: "Italy",      type: "league", logo: "https://crests.football-data.org/SA.png",  ext: 135 },
    { code: "L1",  name: "Ligue 1",               country: "France",     type: "league", logo: "https://crests.football-data.org/FL1.png", ext: 61  },
    { code: "UCL", name: "UEFA Champions League", country: "Europe",     type: "cup",    logo: "https://crests.football-data.org/CL.png",  ext: 2   },
    { code: "MLS", name: "Major League Soccer",   country: "USA/Canada", type: "league", logo: "https://flagcdn.com/w80/us.png",           ext: 253 },
    { code: "CRC", name: "Liga Tica",             country: "Costa Rica", type: "league", logo: "https://media.api-sports.io/football/leagues/162.png", ext: 162 },
    { code: "LMX", name: "Liga MX",               country: "Mexico",     type: "league", logo: "https://media.api-sports.io/football/leagues/262.png", ext: 262 }
  ].freeze

  def up
    COMPETITIONS.each do |l|
      comp = Competition.find_or_create_by!(code: l[:code]) do |c|
        c.name             = l[:name]
        c.competition_type = l[:type]
        c.country          = l[:country]
        c.logo             = l[:logo]
        c.external_id      = l[:ext]
      end
      comp.update!(external_id: l[:ext], logo: l[:logo]) if comp.external_id != l[:ext] || comp.logo != l[:logo]
    end
  end

  def down
    # Keep competitions — no-op
  end
end
