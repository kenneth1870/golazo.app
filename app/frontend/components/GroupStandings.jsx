import { useState, useEffect } from "react"

export default function GroupStandings() {
  const [groups, setGroups] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/standings")
      .then(r => r.json())
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <p className="text-center" style={{ color: "gray", padding: "3rem 0" }}>Loading groups...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          <div className="col-12 title-section">
            <h2 className="heading">Group Stage — World Cup 2022</h2>
          </div>
        </div>

        <div className="row">
          {Object.entries(groups).sort().map(([group, teams]) => (
            <div key={group} className="col-lg-6 mb-5">
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>Group {group}</h3>
                </div>
                <div className="widget-body">
                  <table className="table custom-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Team</th>
                        <th>MP</th>
                        <th>W</th>
                        <th>D</th>
                        <th>L</th>
                        <th>GD</th>
                        <th>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map(s => (
                        <tr key={s.team.id}>
                          <td>{s.rank}</td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 8 }}>
                              {s.team.flag_url && (
                                <img
                                  src={s.team.flag_url}
                                  alt={s.team.code}
                                  className="flag-xs"
                                />
                              )}
                              <strong className="text-white">{s.team.name}</strong>
                            </div>
                          </td>
                          <td>{s.played}</td>
                          <td>{s.won}</td>
                          <td>{s.drawn}</td>
                          <td>{s.lost}</td>
                          <td style={{ color: s.goal_diff > 0 ? "#10b981" : s.goal_diff < 0 ? "#ef4444" : "inherit" }}>
                            {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                          </td>
                          <td><strong className="text-white">{s.points}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
