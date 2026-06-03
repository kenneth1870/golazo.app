import { useState, useEffect } from "react"

export default function TeamsPage() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/teams")
      .then(r => r.json())
      .then(setTeams)
      .finally(() => setLoading(false))
  }, [])

  const byGroup = teams.reduce((acc, t) => {
    const g = t.group || "TBD"
    if (!acc[g]) acc[g] = []
    acc[g].push(t)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {Object.entries(byGroup).sort().map(([group, groupTeams]) => (
            <div key={group} className="col-lg-3 col-md-4 col-6 mb-4">
              <div className="group-teams-card">
                <div className="group-teams-card__header">Group {group}</div>
                <div className="group-teams-card__list">
                  {groupTeams.map(t => (
                    <div key={t.id} className="team-item">
                      {t.flag_url
                        ? <img src={t.flag_url} alt={t.code} className="team-item__flag" onError={e => e.target.style.display='none'} />
                        : <span className="team-item__placeholder">🏳️</span>
                      }
                      <span className="team-item__name">{t.name}</span>
                    </div>
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
