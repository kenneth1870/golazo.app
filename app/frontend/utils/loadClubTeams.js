import { NAV_LEAGUES } from "../components/ClubCompetitionChips"
import { fetchJson } from "./fetchJson"

const CLUB_LEAGUE_CODES = NAV_LEAGUES.map(l => l.path.split("/").pop())

/** Load club teams from league standings for pickers. Returns { teams, error }. */
export function loadClubTeams() {
  return Promise.all(
    CLUB_LEAGUE_CODES.map(code =>
      fetchJson(`/api/v1/standings?competition=${code}`, { soft: true })
        .then(({ data, ok, offline }) => ({ code, ok: ok && !offline, data: ok && !offline ? data : {} }))
    )
  )
    .then(pairs => {
      const seen = new Set()
      const teams = []
      pairs.forEach(({ code, data }) => {
        Object.values(data || {}).flat().forEach(row => {
          const t = row?.team
          if (!t?.name || seen.has(t.name)) return
          seen.add(t.name)
          teams.push({ id: t.name, name: t.name, flag_url: t.flag_url, group: null, code: t.code, league_code: code })
        })
      })
      const sorted = teams.sort((a, b) => a.name.localeCompare(b.name))
      const failedLeagues = pairs.filter(p => !p.ok).length
      return {
        teams: sorted,
        error: sorted.length === 0 && failedLeagues > 0,
      }
    })
    .catch(() => ({ teams: [], error: true }))
}
