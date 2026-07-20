import { NAV_LEAGUES } from "../components/ClubCompetitionChips"

const CLUB_LEAGUE_CODES = NAV_LEAGUES.map(l => l.path.split("/").pop())

export function loadClubTeams(setTeams) {
  Promise.all(
    CLUB_LEAGUE_CODES.map(code =>
      fetch(`/api/v1/standings?competition=${code}`)
        .then(r => r.ok ? r.json().then(data => ({ code, data })) : { code, data: {} })
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
      setTeams(teams.sort((a, b) => a.name.localeCompare(b.name)))
    })
    .catch(() => {})
}
