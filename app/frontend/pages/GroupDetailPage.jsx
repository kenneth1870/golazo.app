import { useParams, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { useMatches } from "../hooks/useMatches"
import MatchRow from "../components/MatchRow"

export default function GroupDetailPage() {
  const { group } = useParams()
  const navigate  = useNavigate()
  const [standings, setStandings] = useState([])

  const { matches, loading } = useMatches("all", { competition: "WC", group })

  useEffect(() => {
    fetch("/api/v1/standings")
      .then(r => r.json())
      .then(data => setStandings(data[group] || []))
  }, [group])

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {/* Standings */}
          <div className="col-lg-5 mb-4">
            <div className="widget-next-match">
              <div className="widget-title"><h3>Group {group} — Standings</h3></div>
              <div className="widget-body p-0">
                <table className="table custom-table mb-0">
                  <thead>
                    <tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr>
                  </thead>
                  <tbody>
                    {standings.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: "center", color: "gray", padding: "1.5rem" }}>No standings yet</td></tr>
                    ) : standings.map(s => (
                      <tr key={s.team.id}>
                        <td>{s.rank}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {s.team.flag_url && <img src={s.team.flag_url} alt="" style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 2 }} />}
                            <strong className="text-white">{s.team.name}</strong>
                          </div>
                        </td>
                        <td>{s.played}</td><td>{s.won}</td><td>{s.drawn}</td><td>{s.lost}</td>
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

          {/* Matches */}
          <div className="col-lg-7">
            <div className="widget-next-match">
              <div className="widget-title"><h3>Group {group} — Matches</h3></div>
              <div className="widget-body p-0">
                {loading
                  ? <div className="loading-shimmer m-3" style={{ height: 200, borderRadius: 8 }} />
                  : matches.length === 0
                  ? <p style={{ color: "gray", textAlign: "center", padding: "2rem" }}>No matches found</p>
                  : matches.map(m => <MatchRow key={m.id} match={m} showDate onClick={() => {}} />)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
