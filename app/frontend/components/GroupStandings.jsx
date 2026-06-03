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

  if (loading) return <div className="loading">Loading groups...</div>

  const groups = teams.reduce((acc, team) => {
    const g = team.group || "TBD"
    if (!acc[g]) acc[g] = []
    acc[g].push(team)
    return acc
  }, {})

  return (
    <div className="groups-container">
      <h2 className="groups-title">Group Stage</h2>
      <div className="groups-grid">
        {Object.entries(groups).sort().map(([group, groupTeams]) => (
          <div key={group} className="group-card">
            <h3 className="group-label">Group {group}</h3>
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="team-col">Team</th>
                  <th>MP</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GD</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {groupTeams.map(team => (
                  <tr key={team.id}>
                    <td className="team-col">
                      {team.flag_url && <img src={team.flag_url} alt="" className="flag-sm" />}
                      <span>{team.name}</span>
                    </td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td className="pts">0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
