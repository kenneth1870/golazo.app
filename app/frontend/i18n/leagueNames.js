/**
 * Spanish translations for common league / competition names returned by the API.
 * Keyed by the exact English string the API returns.
 */
const ES = {
  // FIFA / International
  "FIFA World Cup 2026":          "Copa Mundial FIFA 2026",
  "FIFA World Cup":               "Copa Mundial FIFA",
  "World Cup":                    "Copa del Mundo",
  "International Friendlies":     "Amistosos Internacionales",
  "UEFA Nations League":          "Liga de Naciones UEFA",
  "CONMEBOL World Cup Qualifying":"Eliminatorias CONMEBOL",
  "UEFA World Cup Qualifying":    "Eliminatorias UEFA",
  "AFC World Cup Qualifying":     "Eliminatorias AFC",
  "CAF World Cup Qualifying":     "Eliminatorias CAF",
  "CONCACAF World Cup Qualifying":"Eliminatorias CONCACAF",
  "OFC World Cup Qualifying":     "Eliminatorias OFC",

  // Club – Europe
  "UEFA Champions League":        "Liga de Campeones UEFA",
  "UEFA Europa League":           "Liga Europa UEFA",
  "UEFA Europa Conference League":"Conference League UEFA",
  "UEFA Super Cup":               "Supercopa UEFA",
  "Premier League":               "Premier League",
  "La Liga":                      "La Liga",
  "Bundesliga":                   "Bundesliga",
  "Serie A":                      "Serie A",
  "Ligue 1":                      "Ligue 1",
  "Eredivisie":                   "Eredivisie",
  "Primeira Liga":                "Primeira Liga",
  "Super Lig":                    "Süper Lig",

  // Club – Americas
  "Copa Libertadores":            "Copa Libertadores",
  "Copa Sudamericana":            "Copa Sudamericana",
  "CONCACAF Champions Cup":       "Copa de Campeones CONCACAF",
  "CONCACAF Champions League":    "Concachampions",
  "CONCACAF Central American Cup":"Copa Centroamericana",
  "Copa Centroamericana":         "Copa Centroamericana",
  "Concachampions":               "Concachampions",
  "Liga MX":                      "Liga MX",
  "Brasileirao Serie A":          "Brasileirao Serie A",
  "Argentine Primera Division":   "Primera División Argentina",
  "MLS":                          "MLS",
  "Liga Tica":                    "Liga Tica",
  "Primera División":             "Primera División",

  // Domestic cups
  "FA Cup":                       "FA Cup",
  "EFL Cup":                      "Copa EFL",
  "Copa del Rey":                 "Copa del Rey",
  "DFB Pokal":                    "Copa DFB",
  "Coppa Italia":                 "Copa Italia",
  "Coupe de France":              "Copa de Francia",
}

/**
 * Returns the localised competition name.
 * Falls back to the original English name if no translation exists.
 *
 * @param {string|null|undefined} name  – English name from the API
 * @param {string} lang                – current i18n language code, e.g. "es"
 * @returns {string}
 */
const COUNTRY_ES = {
  "World":         "Mundial",
  "International": "Internacional",
  "Europe":        "Europa",
  "South America": "Sudamérica",
  "North America": "Norteamérica",
  "Africa":        "África",
  "Asia":          "Asia",
  "Oceania":       "Oceanía",
}

const LEAGUE_REGION_BY_CODE = {
  CAC: { es: "Centroamérica", en: "Central America" },
  CCC: { es: "CONCACAF", en: "CONCACAF" },
  CRC: { es: "Costa Rica", en: "Costa Rica" },
  LMX: { es: "México", en: "Mexico" },
  MLS: { es: "Estados Unidos", en: "United States" },
  UCL: { es: "Europa", en: "Europe" },
  PL:  { es: "Inglaterra", en: "England" },
  LAL: { es: "España", en: "Spain" },
  BL1: { es: "Alemania", en: "Germany" },
  SA:  { es: "Italia", en: "Italy" },
  L1:  { es: "Francia", en: "France" },
}

export function translateLeague(name, lang) {
  if (!name) return name
  const base = (lang || "en").split("-")[0].toLowerCase()
  if (base === "es" && ES[name]) return ES[name]
  return name
}

export function translateCountry(country, lang) {
  if (!country) return null
  const base = (lang || "en").split("-")[0].toLowerCase()
  return base === "es" ? (COUNTRY_ES[country] ?? country) : country
}

/** Region label for a competition block — avoids "World" → "Mundial" on club cups. */
export function competitionRegion(comp, lang) {
  if (!comp) return null
  const code = comp.code?.toString().toUpperCase()
  const mapped = LEAGUE_REGION_BY_CODE[code]
  if (mapped) {
    const base = (lang || "en").split("-")[0].toLowerCase()
    return base === "es" ? mapped.es : mapped.en
  }
  if (comp.country === "World") return null
  return translateCountry(comp.country, lang)
}
