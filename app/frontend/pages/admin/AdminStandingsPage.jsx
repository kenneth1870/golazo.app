import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

export default function AdminStandingsPage() {
  const { authFetch } = useAuthContext()
  const [groups,  setGroups]  = useState({})
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")

  useEffect(() => {
    authFetch("/api/v1/admin/standings").then(r => r.json()).then(setGroups).finally(() => setLoading(false))
  }, [])

  const th = (label) => (
    <th style={{ padding: "8px 12px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "right", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{label}</th>
  )

  const filtered = Object.fromEntries(
    Object.entries(groups).filter(([g]) => !search || `group ${g}`.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Standings</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.82rem", margin: "4px 0 0" }}>
            FIFA World Cup 2026 — {Object.keys(groups).length} groups
          </p>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter group…"
          style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.85rem", outline: "none", width: 160 }}
        />
      </div>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 20 }}>
          {Object.entries(filtered).sort(([a],[b]) => a.localeCompare(b)).map(([group, rows]) => (
            <div key={group} style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "rgba(238,30,70,.08)", borderBottom: "1px solid rgba(238,30,70,.15)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#ee1e46", color: "#fff", fontWeight: 800, fontSize: "0.72rem", borderRadius: 5, padding: "2px 8px", letterSpacing: ".06em" }}>
                  GROUP {group}
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "6px 12px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>#</th>
                    <th style={{ padding: "6px 12px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>Team</th>
                    {th("P")} {th("W")} {th("D")} {th("L")} {th("GF")} {th("GA")} {th("GD")} {th("Pts")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.team.id} style={{ borderTop: "1px solid rgba(255,255,255,.04)", background: i < 2 ? "rgba(16,185,129,.03)" : "transparent" }}>
                      <td style={{ padding: "8px 12px", color: i < 2 ? "#10b981" : "rgba(255,255,255,.3)", fontSize: "0.8rem", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {r.team.flag_url && <img src={r.team.flag_url} alt="" style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2 }} onError={e => e.target.style.display="none"} />}
                          <span style={{ color: "#fff", fontSize: "0.82rem", fontWeight: 600 }}>{r.team.name}</span>
                        </div>
                      </td>
                      {[r.played, r.won, r.drawn, r.lost, r.goals_for, r.goals_against, r.goal_diff].map((v, j) => (
                        <td key={j} style={{ padding: "8px 10px", color: "rgba(255,255,255,.5)", fontSize: "0.8rem", textAlign: "right" }}>{v}</td>
                      ))}
                      <td style={{ padding: "8px 12px", color: "#fff", fontSize: "0.85rem", fontWeight: 800, textAlign: "right" }}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
