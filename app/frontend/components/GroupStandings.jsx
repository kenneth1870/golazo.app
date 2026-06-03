import { useState, useEffect } from "react"

export default function GroupStandings() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/teams")
      .then(r => r.json())
      .then(setTeams)
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

  const groups = teams.reduce((acc, team) => {
    const g = team.group || "TBD"
    if (!acc[g]) acc[g] = []
    acc[g].push(team)
    return acc
  }, {})

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          <div className="col-12 title-section">
            <h2 className="heading">Group Stage — Mundial 2026</h2>
          </div>
        </div>

        <div className="row">
          {Object.entries(groups).sort().map(([group, groupTeams]) => (
            <div key={group} className="col-lg-6 mb-5">
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>Group {group}</h3>
                </div>
                <div className="widget-body">
                  <table className="table custom-table">
                    <thead>
                      <tr>
                        <th>P</th>
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
                      {groupTeams.map((team, idx) => (
                        <tr key={team.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                              {team.flag_url && (
                                <img
                                  src={team.flag_url}
                                  alt={team.code}
                                  style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 2 }}
                                />
                              )}
                              <strong className="text-white">{team.name}</strong>
                            </div>
                          </td>
                          <td>0</td>
                          <td>0</td>
                          <td>0</td>
                          <td>0</td>
                          <td>0</td>
                          <td><strong className="text-white">0</strong></td>
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
