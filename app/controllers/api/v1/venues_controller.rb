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
        matches_by_venue = wc ? venue_matches_for(wc) : {}

        render json: VENUES.map { |v|
          v.merge(matches: serialize_venue_matches(matches_by_venue, v[:name]))
        }
      end

      def show
        slug = params[:slug]
        # API-Football sometimes appends the city to the venue name (e.g. "Lumen Field, Seattle"),
        # so the incoming slug may be longer than the VENUES constant slug. Accept any slug that
        # starts with the canonical slug ("lumen-field-seattle" → matches "lumen-field").
        venue = VENUES.find { |v|
          vs = slugify(v[:name])
          slug == vs || slug.start_with?("#{vs}-") || vs.start_with?("#{slug}-")
        }
        return render json: { error: "Not found" }, status: :not_found unless venue

        wc = Competition.find_by(code: "WC")
        matches_by_venue = wc ? venue_matches_for(wc) : {}
        image_url = wc ? resolve_venue_image(venue[:name], wc) : nil

        render json: venue.merge(
          matches:   serialize_venue_matches(matches_by_venue, venue[:name]),
          image_url: image_url
        )
      end

      private

      def slugify(name)
        name.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-|-\z/, "")
      end

      # Resolves the API-Football venue photo URL for a named venue.
      # Cached 7 days — photo URLs and venue IDs are stable.
      def resolve_venue_image(venue_name, competition)
        Rails.cache.fetch("venue_img_v1_#{venue_name.parameterize}", expires_in: 7.days) do
          match = Match.where(competition: competition)
                       .where("venue LIKE ?", "#{venue_name}%")
                       .where.not(external_id: nil)
                       .order(Arel.sql("CASE WHEN status = 'finished' THEN 0 ELSE 1 END"), :kickoff_at)
                       .first
          next nil unless match

          client    = LiveScoresClient.new
          venue_id  = client.fixture_venue_id(match.external_id)
          next nil unless venue_id

          detail = client.venue_detail(venue_id)
          detail&.dig(:image)
        end
      rescue => e
        Rails.logger.warn("[VenuesController] resolve_venue_image #{venue_name}: #{e.message}")
        nil
      end

      def venue_matches_for(competition)
        Match.where(competition: competition)
             .where.not(venue: [ nil, "" ])
             .includes(:home_team, :away_team)
             .order(:kickoff_at)
             .group_by(&:venue)
      end

      def serialize_venue_matches(matches_by_venue, venue_name)
        matches_by_venue
          .select { |k, _| k.to_s.start_with?(venue_name) }
          .values.flatten
          .map { |m|
            {
              id:          m.id,
              external_id: m.external_id,
              kickoff_at:  m.kickoff_at,
              status:      m.status,
              minute:      m.minute,
              round:       m.round,
              group_stage: m.group_stage,
              home_score:  m.home_score,
              away_score:  m.away_score,
              home_team: { name: m.home_team.name, flag_url: m.home_team.flag_url, code: m.home_team.code },
              away_team: { name: m.away_team.name, flag_url: m.away_team.flag_url, code: m.away_team.code }
            }
          }
      end
    end
  end
end
