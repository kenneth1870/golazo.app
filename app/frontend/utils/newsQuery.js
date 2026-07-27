export function relativeTime(published_at, t) {
  if (!published_at || !t) return ""
  const diff = Math.floor((Date.now() - new Date(published_at).getTime()) / 1000)
  if (diff <= 0)    return t("time.agoJustNow")
  if (diff < 60)    return t("time.agoSeconds", { count: diff })
  if (diff < 3600)  return t("time.agoMinutes", { count: Math.floor(diff / 60) })
  if (diff < 86400) return t("time.agoHours", { count: Math.floor(diff / 3600) })
  return t("time.agoDays", { count: Math.floor(diff / 86400) })
}

export function buildNewsQuery(names, lang, translateTeam) {
  const GENERIC = new Set(["real", "city", "club", "united", "atletico", "atleticó", "sporting", "deportivo"])
  const words = names
    .filter(Boolean)
    .flatMap(name => {
      const translated = translateTeam ? (translateTeam(name, lang) ?? name) : name
      return [name, translated]
    })
    .flatMap(n => n.toLowerCase().split(/[\s\-\/]+/))
    .filter(w => w.length > 3 && !GENERIC.has(w))

  return [...new Set(words)].slice(0, 8).join(",")
}

const NEWS_SEARCHABLE_LEAGUES = new Set([
  "premier league", "la liga", "serie a", "bundesliga", "ligue 1",
  "eredivisie", "primeira liga", "champions league", "europa league",
  "conference league", "copa del rey", "fa cup", "carabao cup",
  "mls", "copa america", "euros", "nations league", "libertadores",
  "liga mx", "liga tica",
])

export function buildMatchNewsQuery(homeName, awayName, leagueName) {
  const GENERIC = new Set(["real", "city", "club", "united", "atletico", "atleticó"])
  const leagueWords = leagueName &&
    NEWS_SEARCHABLE_LEAGUES.has(leagueName.toLowerCase().trim())
      ? leagueName.toLowerCase().split(/[\s\-\/]+/).filter(k => k.length > 3)
      : []
  const words = [
    ...[homeName, awayName]
      .filter(Boolean)
      .flatMap(n => n.toLowerCase().split(/[\s\-\/]+/))
      .filter(k => k.length > 3 && !GENERIC.has(k)),
    ...leagueWords,
  ]
  return [...new Set(words)].slice(0, 10).join(",")
}
