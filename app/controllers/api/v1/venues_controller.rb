module Api
  module V1
    class VenuesController < BaseController
      VENUES = [
        { name: "MetLife Stadium",        city: "East Rutherford, NJ", country: "USA", capacity: 82_500, group: "Final venue" },
        { name: "AT&T Stadium",           city: "Arlington, TX",       country: "USA", capacity: 80_000, group: "Group stage" },
        { name: "SoFi Stadium",           city: "Inglewood, CA",       country: "USA", capacity: 70_240, group: "Group stage" },
        { name: "Levi's Stadium",         city: "Santa Clara, CA",     country: "USA", capacity: 68_500, group: "Group stage" },
        { name: "Hard Rock Stadium",      city: "Miami Gardens, FL",   country: "USA", capacity: 65_000, group: "Group stage" },
        { name: "Arrowhead Stadium",      city: "Kansas City, MO",     country: "USA", capacity: 76_416, group: "Group stage" },
        { name: "Gillette Stadium",       city: "Foxborough, MA",      country: "USA", capacity: 65_878, group: "Group stage" },
        { name: "Rose Bowl",              city: "Pasadena, CA",        country: "USA", capacity: 88_565, group: "Group stage" },
        { name: "Lincoln Financial Field",city: "Philadelphia, PA",    country: "USA", capacity: 69_796, group: "Group stage" },
        { name: "Empower Field",          city: "Denver, CO",          country: "USA", capacity: 76_125, group: "Group stage" },
        { name: "Lumen Field",             city: "Seattle, WA",         country: "USA", capacity: 72_000, group: "Group stage" },
        { name: "BC Place",               city: "Vancouver, BC",       country: "Canada", capacity: 54_500, group: "Group stage" },
        { name: "BMO Field",              city: "Toronto, ON",         country: "Canada", capacity: 45_736, group: "Group stage" },
        { name: "Estadio Akron",          city: "Guadalajara",         country: "Mexico", capacity: 49_850, group: "Group stage" },
        { name: "Estadio BBVA",           city: "Monterrey",           country: "Mexico", capacity: 53_500, group: "Group stage" },
        { name: "Estadio Azteca",         city: "Mexico City",         country: "Mexico", capacity: 83_132, group: "Opening match" },
      ].freeze

      def index
        render json: VENUES
      end
    end
  end
end
