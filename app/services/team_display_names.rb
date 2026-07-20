# Maps stale API-Football team names to current display names.
# Keep in sync with app/frontend/i18n/teamNames.js DISPLAY_NAMES.
module TeamDisplayNames
  OVERRIDES = {
    "municipal liberia"                       => "Escorpiones",
    "ad municipal liberia"                    => "Escorpiones",
    "asociacion deportiva municipal liberia"    => "Escorpiones",
    "asociación deportiva municipal liberia"    => "Escorpiones",
    "ld alajuelense"                          => "Alajuelense",
    "cs herediano"                            => "Herediano",
    "cs cartagines"                           => "Cartaginés",
    "deportivo saprissa"                      => "Saprissa",
    "perez zeledon"                           => "Pérez Zeledón",
    "sporting san jose"                       => "Sporting FC"
  }.freeze

  # API still serves Municipal Liberia (826); Escorpiones crest is team 17784.
  ESCORPIONES_LOGO = "https://media.api-sports.io/football/teams/17784.png".freeze

  def self.display_name(name)
    return name if name.blank?

    key = name.to_s.downcase.strip
    OVERRIDES[key] || name
  end

  def self.flag_url(name, current_url = nil)
    return current_url if name.blank?

    key = name.to_s.downcase.strip
    return ESCORPIONES_LOGO if OVERRIDES[key] == "Escorpiones"

    current_url
  end
end
