import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../../hooks/usePageMeta"
import { fetchJson } from "../../utils/fetchJson"
import OfflineBanner from "../../components/OfflineBanner"
import { translateTeam } from "../../i18n/teamNames"

export default function TeamsPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("mundial.teamsTitle"), "All 48 teams in the FIFA World Cup 2026 — groups, flags and match schedules.")
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stale, setStale] = useState(false)

  const load = () => {
    setError(false)
    setStale(false)
    setLoading(true)
    fetchJson("/api/v1/teams?competition=WC")
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) { setError(true); return }
        setTeams(Array.isArray(data) ? data : data?.teams || [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const byGroup = teams.reduce((acc, team) => {
    const g = team.group || "TBD"
    if (!acc[g]) acc[g] = []
    acc[g].push(team)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  if (error) return (
    <div className="site-section">
      <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
        <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
        <button className="btn btn-primary btn-sm" onClick={load}>{t("error.retry")}</button>
      </div>
    </div>
  )

  return (
    <div className="site-section">
      <OfflineBanner stale={stale} onRetry={load} />
      <div className="container">
        <div className="row">
          {Object.entries(byGroup).sort().map(([group, groupTeams]) => (
            <div key={group} className="col-lg-3 col-md-4 col-6 mb-4">
              <div className="group-teams-card">
                <div className="group-teams-card__header">{t("nav.group", { letter: group })}</div>
                <div className="group-teams-card__list">
                  {groupTeams.map(team => (
                    <Link key={team.id} to={`/teams/${team.id}`} className="team-item" style={{ textDecoration: "none" }}>
                      {team.flag_url
                        ? <img src={team.flag_url} alt={team.code} className="team-item__flag" onError={e => e.target.style.display='none'} />
                        : <span className="team-item__placeholder">🏳️</span>
                      }
                      <span className="team-item__name">{translateTeam(team.name, i18n.language) || team.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
