# Maps stale API-Football team names to current display names.
# Keep in sync with app/frontend/i18n/teamNames.js DISPLAY_NAMES.
module TeamDisplayNames
  OVERRIDES = {
    "municipal liberia"                       => "Escorpiones Belén",
    "ad municipal liberia"                    => "Escorpiones Belén",
    "asociacion deportiva municipal liberia"    => "Escorpiones Belén",
    "asociación deportiva municipal liberia"    => "Escorpiones Belén",
    "ld alajuelense"                          => "Alajuelense",
    "cs herediano"                            => "Herediano",
    "cs cartagines"                           => "Cartaginés",
    "deportivo saprissa"                      => "Saprissa",
    "perez zeledon"                           => "Pérez Zeledón",
    "sporting san jose"                       => "Sporting FC",
    "escorpiones"                             => "Escorpiones Belén"
  }.freeze

  # Collapse stale rebrand slugs when deduping fixtures.
  DEDUP_ALIASES = {
    "escorpiones" => "escorpiones-belen"
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
    return ESCORPIONES_LOGO if slug_for(name).start_with?("escorpiones")

    current_url
  end

  def self.slug_for(name)
    display_name(name).to_s.parameterize
  end

  def self.dedup_slug(name)
    slug = slug_for(name)
    DEDUP_ALIASES[slug] || slug
  end

  def self.matches_slug?(name, slug)
    slug_for(name) == slug.to_s
  end
end
