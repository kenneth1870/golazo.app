module Api
  module V1
    class VenuesController < BaseController
      VENUES = [
        # United States (11 venues)
        { name: "MetLife Stadium",         city: "East Rutherford, NJ", country: "USA",    capacity: 82_500, group: "Final venue"   },
        { name: "AT&T Stadium",            city: "Arlington, TX",       country: "USA",    capacity: 80_000, group: "Group stage"   },
        { name: "Arrowhead Stadium",       city: "Kansas City, MO",     country: "USA",    capacity: 76_416, group: "Group stage"   },
        { name: "Lumen Field",             city: "Seattle, WA",         country: "USA",    capacity: 72_220, group: "Group stage"   },
        { name: "NRG Stadium",             city: "Houston, TX",         country: "USA",    capacity: 72_220, group: "Group stage"   },
        { name: "Mercedes-Benz Stadium",   city: "Atlanta, GA",         country: "USA",    capacity: 71_000, group: "Group stage"   },
        { name: "Lincoln Financial Field", city: "Philadelphia, PA",    country: "USA",    capacity: 69_796, group: "Group stage"   },
        { name: "SoFi Stadium",            city: "Inglewood, CA",       country: "USA",    capacity: 70_240, group: "Group stage"   },
        { name: "Levi's Stadium",          city: "Santa Clara, CA",     country: "USA",    capacity: 68_500, group: "Group stage"   },
        { name: "Hard Rock Stadium",       city: "Miami Gardens, FL",   country: "USA",    capacity: 65_000, group: "Group stage"   },
        { name: "Gillette Stadium",        city: "Foxborough, MA",      country: "USA",    capacity: 65_878, group: "Group stage"   },
        # Canada (2 venues)
        { name: "BC Place",                city: "Vancouver, BC",       country: "Canada", capacity: 54_500, group: "Group stage"   },
        { name: "BMO Field",               city: "Toronto, ON",         country: "Canada", capacity: 45_736, group: "Group stage"   },
        # Mexico (3 venues)
        { name: "Estadio Azteca",          city: "Mexico City",         country: "Mexico", capacity: 83_132, group: "Opening match" },
        { name: "Estadio BBVA",            city: "Monterrey",           country: "Mexico", capacity: 53_500, group: "Group stage"   },
        { name: "Estadio Akron",           city: "Guadalajara",         country: "Mexico", capacity: 49_850, group: "Group stage"   }
      ].freeze

      def index
        wc = Competition.find_by(code: "WC")
        matches_by_venue = if wc
          Match.where(competition: wc)
               .where.not(venue: [ nil, "" ])
               .includes(:home_team, :away_team)
               .order(:kickoff_at)
               .group_by(&:venue)
        else
          {}
        end

        render json: VENUES.map { |v|
          venue_matches = matches_by_venue.select { |k, _| k.to_s.start_with?(v[:name]) }
                                          .values.flatten
          v.merge(
            matches: venue_matches.map { |m|
              {
                id:         m.id,
                external_id: m.external_id,
                kickoff_at:  m.kickoff_at,
                status:      m.status,
                round:       m.round,
                group_stage: m.group_stage,
                home_score:  m.home_score,
                away_score:  m.away_score,
                home_team: { name: m.home_team.name, flag_url: m.home_team.flag_url, code: m.home_team.code },
                away_team: { name: m.away_team.name, flag_url: m.away_team.flag_url, code: m.away_team.code }
              }
            }
          )
        }
      end
    end
  end
end
