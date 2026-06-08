// Primary accent color for national teams and major clubs.
// Used to tint match pages, team pages, and bracket slots.
// Keys are lowercase team names (partial match supported).

const TEAM_COLORS = {
  // WC 2026 National Teams
  "argentina":     "#74ACDF",
  "brazil":        "#009C3B",
  "france":        "#003189",
  "england":       "#FFFFFF",
  "spain":         "#AA151B",
  "germany":       "#000000",
  "portugal":      "#006600",
  "netherlands":   "#FF6600",
  "belgium":       "#EF3340",
  "croatia":       "#FF0000",
  "italy":         "#003DA5",
  "mexico":        "#006847",
  "usa":           "#002868",
  "united states": "#002868",
  "canada":        "#FF0000",
  "japan":         "#BC002D",
  "south korea":   "#003478",
  "australia":     "#00843D",
  "morocco":       "#C1272D",
  "senegal":       "#00853F",
  "nigeria":       "#008751",
  "ghana":         "#006B3F",
  "cameroon":      "#007A5E",
  "south africa":  "#007A4D",
  "egypt":         "#CE1126",
  "saudi arabia":  "#006C35",
  "iran":          "#239F40",
  "colombia":      "#FCD116",
  "uruguay":       "#75AADB",
  "chile":         "#D52B1E",
  "ecuador":       "#FFD100",
  "peru":          "#D91023",
  "paraguay":      "#D52B1E",
  "venezuela":     "#CF142B",
  "bolivia":       "#D52B1E",
  "costa rica":    "#002B7F",
  "panama":        "#DA121A",
  "honduras":      "#0073CF",
  "el salvador":   "#0F47AF",
  "jamaica":       "#000000",
  "cuba":          "#CF142B",
  "trinidad":      "#CE1126",
  "new zealand":   "#000000",
  "poland":        "#DC143C",
  "ukraine":       "#005BBB",
  "serbia":        "#C6363C",
  "austria":       "#ED2939",
  "switzerland":   "#FF0000",
  "denmark":       "#C60C30",
  "sweden":        "#006AA7",
  "norway":        "#EF2B2D",
  "finland":       "#003580",
  "czech republic":"#D7141A",
  "slovakia":      "#0B4EA2",
  "hungary":       "#CE2939",
  "romania":       "#002B7F",
  "turkey":        "#E30A17",
  "greece":        "#0D5EAF",
  "scotland":      "#003DA5",
  "wales":         "#C8102E",
  "ireland":       "#169B62",
  "albania":       "#E41E20",
  "slovenia":      "#003DA5",
  // Major clubs (for non-WC league pages)
  "real madrid":   "#FEBE10",
  "barcelona":     "#A50044",
  "manchester city":"#6CABDD",
  "manchester united":"#DA291C",
  "liverpool":     "#C8102E",
  "arsenal":       "#EF0107",
  "chelsea":       "#034694",
  "tottenham":     "#132257",
  "inter":         "#0068A8",
  "milan":         "#FB090B",
  "juventus":      "#000000",
  "napoli":        "#12A0D7",
  "psg":           "#004170",
  "paris saint":   "#004170",
  "bayern":        "#DC052D",
  "dortmund":      "#FDE100",
  "atletico":      "#CB3524",
  "sevilla":       "#D91A21",
  "valencia":      "#EE7F00",
  "ajax":          "#D2122E",
  "porto":         "#003DA5",
  "benfica":       "#E21A1A",
}

/**
 * Returns a hex color for a team name, or null if not found.
 * Accepts partial lowercase matches (e.g. "manchester" → city color).
 */
export function getTeamColor(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  // Exact match first
  if (TEAM_COLORS[lower]) return TEAM_COLORS[lower]
  // Partial match
  const key = Object.keys(TEAM_COLORS).find(k => lower.includes(k) || k.includes(lower))
  return key ? TEAM_COLORS[key] : null
}

/**
 * Given home + away team names, returns the home team color
 * with a sensible fallback to the away color, then default accent.
 */
export function getMatchColor(homeName, awayName) {
  return getTeamColor(homeName) || getTeamColor(awayName) || null
}
