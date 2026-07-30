import { translateTeam } from "../i18n/teamNames"

/** Stable id for deduping the same fixture across sections. */
export function matchKey(m) {
  if (!m) return ""
  return String(m.id ?? m.external_id ?? "")
}

/** True if a fixture team name matches a followed team (exact or translated). */
export function matchTeamName(teamName, favName, lang) {
  if (!teamName || !favName) return false
  const team = teamName.toLowerCase().trim()
  const fav = favName.toLowerCase().trim()
  if (team === fav) return true
  const translated = translateTeam(teamName, lang)?.toLowerCase().trim()
  if (translated && translated === fav) return true
  const favTranslated = translateTeam(favName, lang)?.toLowerCase().trim()
  return !!(favTranslated && team === favTranslated)
}
