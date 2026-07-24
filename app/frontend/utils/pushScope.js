const TEAMS_KEY = "push_sub_teams"
const LEAGUES_KEY = "push_sub_leagues"

export function loadPushScope() {
  try {
    return {
      teamNames: JSON.parse(localStorage.getItem(TEAMS_KEY) || "[]"),
      competitionCodes: JSON.parse(localStorage.getItem(LEAGUES_KEY) || "[]"),
    }
  } catch {
    return { teamNames: [], competitionCodes: [] }
  }
}

export function savePushScope({ teamNames, competitionCodes }) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teamNames || []))
  localStorage.setItem(LEAGUES_KEY, JSON.stringify(competitionCodes || []))
}

export function scopeFromFavorites(favorites) {
  const teamNames = favorites
    .filter(f => f.type === "team")
    .map(f => f.name)
    .filter(Boolean)
  const competitionCodes = favorites
    .filter(f => f.type === "competition")
    .map(f => f.code || f.id)
    .filter(Boolean)
  return { teamNames, competitionCodes }
}

export function hasPushScope({ teamNames = [], competitionCodes = [] } = {}) {
  return teamNames.length > 0 || competitionCodes.length > 0
}
