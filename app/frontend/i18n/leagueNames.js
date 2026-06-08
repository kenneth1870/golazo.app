/**
 * Spanish translations for common league / competition names returned by the API.
 * Keyed by the exact English string the API returns.
 */
const ES = {
  // FIFA / International
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
  "Liga MX":                      "Liga MX",
  "Brasileirao Serie A":          "Brasileirao Serie A",
  "Argentine Primera Division":   "Primera División Argentina",
  "MLS":                          "MLS",

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
export function translateLeague(name, lang) {
  if (!name) return name
  const base = (lang || "en").split("-")[0].toLowerCase()
  if (base === "es" && ES[name]) return ES[name]
  return name
}
