/** Costa Rica / CONCACAF-first ordering for competition lists. */

export const LATAM_PRIORITY = ["CRC", "LMX", "CAC", "CCC"]

export const COMPETITION_PRIORITY = [
  "CRC", "CAC", "CCC", "LMX",
  "UCL", "PL", "LAL", "BL1", "SA", "L1", "MLS", "WC",
]

export function competitionPriority(code) {
  const c = (code || "").toUpperCase()
  const idx = COMPETITION_PRIORITY.indexOf(c)
  return idx >= 0 ? idx : 200
}

/** Sort competition groups: live first, then CR/LATAM priority, then name. */
export function sortCompetitionGroups(groups) {
  return [...groups].sort((a, b) => {
    const aLive = a.some(m => m.status === "live") ? 0 : 1
    const bLive = b.some(m => m.status === "live") ? 0 : 1
    if (aLive !== bLive) return aLive - bLive

    const codeA = a[0]?.competition?.code
    const codeB = b[0]?.competition?.code
    const pri = competitionPriority(codeA) - competitionPriority(codeB)
    if (pri !== 0) return pri

    const nameA = a[0]?.competition?.name ?? ""
    const nameB = b[0]?.competition?.name ?? ""
    return nameA.localeCompare(nameB)
  })
}

/** Sort flat competition records (e.g. All Leagues LATAM section). */
export function sortCompetitions(comps) {
  return [...comps].sort((a, b) => {
    const pri = competitionPriority(a.code) - competitionPriority(b.code)
    if (pri !== 0) return pri
    return (a.name || "").localeCompare(b.name || "")
  })
}
