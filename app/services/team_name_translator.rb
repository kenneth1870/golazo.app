# Backend mirror of app/frontend/i18n/teamNames.js — translates national team
# names to Spanish for push notifications (which are rendered server-side, so
# the frontend i18n can't help). Keep this in sync with the frontend ES map.
module TeamNameTranslator
  ES = {
    # Americas
    "United States" => "Estados Unidos", "Mexico" => "México", "Brazil" => "Brasil",
    "Canada" => "Canadá", "Haiti" => "Haití", "Panama" => "Panamá",
    "Colombia" => "Colombia", "Ecuador" => "Ecuador", "Argentina" => "Argentina",
    "Uruguay" => "Uruguay", "Chile" => "Chile", "Peru" => "Perú",
    "Costa Rica" => "Costa Rica", "Jamaica" => "Jamaica", "Cuba" => "Cuba",
    "Honduras" => "Honduras", "Guatemala" => "Guatemala", "El Salvador" => "El Salvador",
    "Trinidad and Tobago" => "Trinidad y Tobago", "Dominican Republic" => "República Dominicana",
    "Bolivia" => "Bolivia", "Venezuela" => "Venezuela", "Paraguay" => "Paraguay",

    # Europe
    "Germany" => "Alemania", "France" => "Francia", "Spain" => "España",
    "England" => "Inglaterra", "Portugal" => "Portugal", "Netherlands" => "Países Bajos",
    "Belgium" => "Bélgica", "Switzerland" => "Suiza", "Austria" => "Austria",
    "Denmark" => "Dinamarca", "Sweden" => "Suecia", "Norway" => "Noruega",
    "Finland" => "Finlandia", "Poland" => "Polonia", "Czech Republic" => "República Checa",
    "Czechia" => "República Checa", "Hungary" => "Hungría", "Romania" => "Rumania",
    "Greece" => "Grecia", "Turkey" => "Turquía", "Türkiye" => "Turquía", "Albania" => "Albania",
    "Slovakia" => "Eslovaquia", "Slovenia" => "Eslovenia", "Scotland" => "Escocia",
    "Wales" => "Gales", "Northern Ireland" => "Irlanda del Norte", "Ireland" => "Irlanda",
    "Ukraine" => "Ucrania", "Serbia" => "Serbia", "Croatia" => "Croacia", "Italy" => "Italia",

    # Africa
    "South Africa" => "Sudáfrica", "Ivory Coast" => "Costa de Marfil",
    "Côte d'Ivoire" => "Costa de Marfil", "Morocco" => "Marruecos", "Senegal" => "Senegal",
    "Nigeria" => "Nigeria", "Cameroon" => "Camerún", "Ghana" => "Ghana", "Egypt" => "Egipto",
    "Algeria" => "Argelia", "Tunisia" => "Túnez", "Kenya" => "Kenia", "Tanzania" => "Tanzania",
    "Democratic Republic of Congo" => "República Democrática del Congo", "DR Congo" => "RD Congo",

    # Asia
    "South Korea" => "Corea del Sur", "Korea Republic" => "Corea del Sur",
    "North Korea" => "Corea del Norte", "Korea DPR" => "Corea del Norte",
    "Saudi Arabia" => "Arabia Saudita", "Iran" => "Irán", "Japan" => "Japón",
    "China" => "China", "China PR" => "China", "Australia" => "Australia",
    "New Zealand" => "Nueva Zelanda", "Philippines" => "Filipinas", "Indonesia" => "Indonesia",
    "Thailand" => "Tailandia", "Vietnam" => "Vietnam", "India" => "India", "Iraq" => "Irak",
    "Lebanon" => "Líbano", "Jordan" => "Jordania", "Uzbekistan" => "Uzbekistán",
    "Kazakhstan" => "Kazajistán", "Kyrgyzstan" => "Kirguistán", "Tajikistan" => "Tayikistán",
    "Afghanistan" => "Afganistán",

    # Middle East
    "Qatar" => "Catar", "United Arab Emirates" => "Emiratos Árabes Unidos", "Kuwait" => "Kuwait",
    "Bahrain" => "Baréin", "Oman" => "Omán", "Yemen" => "Yemen", "Syria" => "Siria",
    "Palestine" => "Palestina", "Israel" => "Israel",

    # Caribbean / Oceania
    "Curacao" => "Curazao", "Cape Verde" => "Cabo Verde", "Cabo Verde" => "Cabo Verde",
    "Fiji" => "Fiyi", "Papua New Guinea" => "Papúa Nueva Guinea", "Solomon Islands" => "Islas Salomón",

    # Misc / Eastern Europe
    "Russia" => "Rusia", "Georgia" => "Georgia", "Armenia" => "Armenia",
    "Azerbaijan" => "Azerbaiyán", "Bosnia and Herzegovina" => "Bosnia y Herzegovina",
    "Bosnia & Herz." => "Bosnia y Herz.", "Bosnia & Herzegovina" => "Bosnia y Herzegovina",
    "North Macedonia" => "Macedonia del Norte", "Kosovo" => "Kosovo", "Belarus" => "Bielorrusia",
    "Moldova" => "Moldavia", "Lithuania" => "Lituania", "Latvia" => "Letonia", "Estonia" => "Estonia"
  }.freeze

  # Returns the team name in the given locale, falling back to the original.
  def self.translate(name, locale = "es")
    return name if name.blank?
    base = locale.to_s.split("-").first&.downcase
    base == "es" ? (ES[name] || name) : name
  end
end
