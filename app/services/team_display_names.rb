# Maps stale API-Football team names to current display names.
# Keep in sync with app/frontend/i18n/teamNames.js DISPLAY_NAMES.
module TeamDisplayNames
  OVERRIDES = {
    "municipal liberia"              => "Escorpiones",
    "ad municipal liberia"           => "Escorpiones",
    "asociacion deportiva municipal liberia" => "Escorpiones",
    "asociación deportiva municipal liberia" => "Escorpiones"
  }.freeze

  def self.display_name(name)
    return name if name.blank?

    key = name.to_s.downcase.strip
    OVERRIDES[key] || name
  end
end
