# Canonical featured competitions — kept in sync with AppFocus::FEATURED_CLUB_CODES + WC.
class FeaturedCompetitions
  ENTRIES = {
    "PL"  => { name: "Premier League",        country: "England",    competition_type: "league", external_id: 39,  logo: "https://crests.football-data.org/PL.png" },
    "LAL" => { name: "La Liga",               country: "Spain",      competition_type: "league", external_id: 140, logo: "https://crests.football-data.org/PD.png" },
    "BL1" => { name: "Bundesliga",            country: "Germany",    competition_type: "league", external_id: 78,  logo: "https://crests.football-data.org/BL1.png" },
    "SA"  => { name: "Serie A",               country: "Italy",      competition_type: "league", external_id: 135, logo: "https://crests.football-data.org/SA.png" },
    "L1"  => { name: "Ligue 1",               country: "France",     competition_type: "league", external_id: 61,  logo: "https://crests.football-data.org/FL1.png" },
    "UCL" => { name: "UEFA Champions League", country: "Europe",     competition_type: "cup",    external_id: 2,   logo: "https://crests.football-data.org/CL.png" },
    "MLS" => { name: "Major League Soccer",   country: "USA/Canada", competition_type: "league", external_id: 253, logo: "https://flagcdn.com/w80/us.png" },
    "CRC" => { name: "Liga Tica",             country: "Costa Rica", competition_type: "league", external_id: 162, logo: "https://media.api-sports.io/football/leagues/162.png" },
    "LMX" => { name: "Liga MX",               country: "Mexico",     competition_type: "league", external_id: 262, logo: "https://media.api-sports.io/football/leagues/262.png" },
    "WC"  => { name: "FIFA World Cup 2026",   country: "International", competition_type: "world_cup", external_id: 1, logo: "https://crests.football-data.org/WC.png" }
  }.freeze

  LATAM_CODES = %w[CRC LMX].freeze

  class << self
    def sync_missing!
      ENTRIES.each do |code, attrs|
        comp = Competition.find_or_create_by!(code: code) do |c|
          c.assign_attributes(attrs)
        end
        comp.update!(attrs) if attrs.any? { |k, v| comp.public_send(k) != v }
      end
    end

    def for_api
      sync_missing!
      codes = AppFocus::FEATURED_CLUB_CODES + [ "WC" ]
      by_code = Competition.where(code: codes).index_by(&:code)

      codes.filter_map do |code|
        comp = by_code[code]
        next unless comp

        comp.as_json(only: %i[id name code logo country competition_type external_id]).merge(
          archived: AppFocus.wc_paused? && code == "WC",
          featured: LATAM_CODES.include?(code)
        )
      end
    end
  end
end
