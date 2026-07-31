import { fetchJson } from "./fetchJson"

/** Load all club teams for pickers via a single bulk API call. */
export function loadClubTeams() {
  return fetchJson("/api/v1/club_teams", { soft: true })
    .then(({ data, ok, offline }) => {
      if (!ok || offline || !Array.isArray(data)) return { teams: [], error: true }
      return { teams: data, error: data.length === 0 }
    })
    .catch(() => ({ teams: [], error: true }))
}
