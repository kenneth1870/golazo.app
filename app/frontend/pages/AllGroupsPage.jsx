import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"

function StandingsTable({ group, rows, onNavigate }) {
  return (
    <div className="widget-next-match mb-4" style={{ cursor: "default" }}>
      <div
        className="widget-title d-flex align-items-center"
        style={{ gap: 8, cursor: "pointer" }}
        onClick={onNavigate}
      >
        <h3 style={{ margin: 0 }}>Group {group}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#ee1e46" }}>Matches →</span>
      </div>
      <div className="widget-body p-0" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table className="table custom-table mb-0" style={{ fontSize: "0.8rem", minWidth: 380 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th>Team</th>
              <th title="Played" style={{ textAlign: "center" }}>MP</th>
              <th title="Won"    style={{ textAlign: "center" }}>W</th>
              <th title="Drawn"  style={{ textAlign: "center" }}>D</th>
              <th title="Lost"   style={{ textAlign: "center" }}>L</th>
              <th title="Goals For"     style={{ textAlign: "center" }}>GF</th>
              <th title="Goals Against" style={{ textAlign: "center" }}>GA</th>
              <th title="Goal Difference" style={{ textAlign: "center" }}>GD</th>
              <th title="Points" style={{ textAlign: "center", fontWeight: 700 }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "#555", padding: "1.2rem", fontSize: "0.75rem" }}>
                  Standings available after group stage begins
                </td>
              </tr>
            ) : rows.map((s, i) => (
              <tr key={s.team?.id ?? i} style={{ background: i < 2 ? "rgba(16,185,129,.06)" : "transparent" }}>
                <td style={{ color: i < 2 ? "#10b981" : "#666", fontWeight: 700 }}>{s.rank ?? i + 1}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {s.team?.flag_url && (
                      <img src={s.team.flag_url} alt="" className="flag-xs"
                        onError={e => (e.target.style.display = "none")} />
                    )}
                    <span className="text-white" style={{ fontWeight: 600 }}>{s.team?.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: "center" }}>{s.played ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.won ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.drawn ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.lost ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.goals_for ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.goals_against ?? 0}</td>
                <td style={{ textAlign: "center", color: (s.goal_diff ?? 0) > 0 ? "#10b981" : (s.goal_diff ?? 0) < 0 ? "#ef4444" : "#aaa" }}>
                  {(s.goal_diff ?? 0) > 0 ? `+${s.goal_diff}` : s.goal_diff ?? 0}
                </td>
                <td style={{ textAlign: "center" }}>
                  <strong className="text-white">{s.points ?? 0}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const GROUP_LETTERS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function AllGroupsPage() {
  usePageMeta("Groups", "FIFA World Cup 2026 group standings — all 12 groups with points, goals and results.")
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(data => setGrouped(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const groups = GROUP_LETTERS.filter(g => grouped[g]?.length > 0)
  const displayGroups = groups.length > 0 ? groups : GROUP_LETTERS

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="row">
            {GROUP_LETTERS.map(g => (
              <div key={g} className="col-lg-6 mb-4">
                <div className="loading-shimmer" style={{ height: 200, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {displayGroups.map(g => (
            <div key={g} className="col-lg-6 mb-4">
              <StandingsTable
                group={g}
                rows={grouped[g] || []}
                onNavigate={() => navigate(`/groups/${g}`)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
