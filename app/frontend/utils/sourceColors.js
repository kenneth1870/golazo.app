// Single source of truth for news source brand colours.
// Import this wherever you render news cards so every page stays in sync.
export const SOURCE_COLORS = {
  "BBC Sport":      "#b80000",
  "ESPN FC":        "#cc0000",
  "ESPN Deportes":  "#cc0000",
  "Goal.com":       "#ee1e46",
  "Marca":          "#0f7bca",
  "Radio Gol":      "#f97316",
  "OneFootball":    "#00c853",
  "Vermouth De…":   "#9c27b0",
}

/** Returns the hex colour for a given source name, falling back to accent red. */
export function sourceColor(source) {
  return SOURCE_COLORS[source] || "#ee1e46"
}
