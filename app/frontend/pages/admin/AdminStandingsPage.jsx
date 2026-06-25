import { useState, useEffect, useCallback } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

function HealthBadge({ recalculatedAt }) {
  if (!recalculatedAt) return <span style={{ color: "#f59e0b", fontSize: "0.78rem" }}>No timestamp</span>

  const ageMs   = Date.now() - new Date(recalculatedAt).getTime()
  const ageMins = Math.floor(ageMs / 60000)
  const color   = ageMins < 10 ? "#10b981" : ageMins < 30 ? "#f59e0b" : "#ee1e46"
  const label   = ageMins < 1 ? "just now" : ageMins === 1 ? "1 min ago" : `${ageMins} min ago`

  return (
    <span style={{ color, fontSize: "0.78rem", fontWeight: 700 }}>
      ● {label}
    </span>
  )
}

export default function AdminStandingsPage() {
  const { authFetch } = useAuthContext()
  const [data,        setData]        = useState({})
  const [loading,     setLoading]     = useState(true)
  const [recalcing,   setRecalcing]   = useState(false)
  const [recalcMsg,   setRecalcMsg]   = useState(null)
  const [search,      setSearch]      = useState("")

  const load = useCallback(() => {
    setLoading(true)
    authFetch("/api/v1/admin/standings")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [authFetch])

  useEffect(() => { load() }, [load])

  const handleRecalculate = () => {
    setRecalcing(true)
    setRecalcMsg(null)
    authFetch("/api/v1/admin/standings/recalculate", { method: "POST" })
      .then(r => r.json())
      .then(res => {
        setRecalcMsg(res.ok ? "✅ Recalculated successfully" : `❌ ${res.error}`)
        load()
      })
      .catch(() => setRecalcMsg("❌ Request failed"))
      .finally(() => setRecalcing(false))
  }

  const groups  = data.groups  || {}
  const counts  = data.match_status_counts || {}

  const filtered = Object.fromEntries(
    Object.entries(groups).filter(([g]) => !search || `group ${g}`.toLowerCase().includes(search.toLowerCase()))
  )

  const th = (label) => (
    <th style={{ padding: "8px 12px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "right", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{label}</th>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
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

      {/* Health panel */}
      <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Last recalculated</div>
          <HealthBadge recalculatedAt={data.last_recalculated_at} />
        </div>

        <div style={{ width: 1, height: 32, background: "rgba(255,255,255,.07)" }} />

        {Object.entries(counts).sort().map(([status, count]) => (
          <div key={status}>
            <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{status}</div>
            <span style={{ color: status === "live" ? "#10b981" : status === "finished" ? "#60a5fa" : "rgba(255,255,255,.5)", fontWeight: 700, fontSize: "0.9rem" }}>{count}</span>
          </div>
        ))}

        {data.anomaly_count > 0 && (
          <>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,.07)" }} />
            <div>
              <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>Null scores (finished)</div>
              <span style={{ color: "#ee1e46", fontWeight: 700, fontSize: "0.9rem" }}>⚠ {data.anomaly_count}</span>
            </div>
          </>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {recalcMsg && <span style={{ fontSize: "0.78rem", color: recalcMsg.startsWith("✅") ? "#10b981" : "#ee1e46" }}>{recalcMsg}</span>}
          <button
            onClick={handleRecalculate}
            disabled={recalcing}
            style={{
              background: recalcing ? "rgba(238,30,70,.4)" : "#ee1e46",
              border: "none", borderRadius: 8, padding: "8px 16px",
              color: "#fff", fontWeight: 700, fontSize: "0.82rem",
              cursor: recalcing ? "not-allowed" : "pointer",
              transition: "background .15s"
            }}
          >
            {recalcing ? "Recalculating…" : "↻ Force Recalculate"}
          </button>
        </div>
      </div>

      {/* Groups grid */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 20 }}>
          {Object.entries(filtered).sort(([a],[b]) => a.localeCompare(b)).map(([group, rows]) => (
            <div key={group} style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", background: "rgba(238,30,70,.08)", borderBottom: "1px solid rgba(238,30,70,.15)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "#ee1e46", color: "#fff", fontWeight: 800, fontSize: "0.72rem", borderRadius: 5, padding: "2px 8px", letterSpacing: ".06em" }}>
                  GROUP {group}
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px 6px 12px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>#</th>
                      <th style={{ padding: "6px 8px", color: "rgba(255,255,255,.35)", fontSize: "0.68rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>Team</th>
                      {th("P")} {th("W")} {th("D")} {th("L")} {th("GF")} {th("GA")} {th("GD")}
                      <th style={{ padding: "6px 12px 6px 8px", color: "#ee1e46", fontSize: "0.68rem", textAlign: "right", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.team.id} style={{ borderTop: "1px solid rgba(255,255,255,.04)", background: i < 2 ? "rgba(16,185,129,.03)" : "transparent" }}>
                        <td style={{ padding: "7px 8px 7px 12px", color: i < 2 ? "#10b981" : "rgba(255,255,255,.3)", fontSize: "0.8rem", fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: "7px 8px", minWidth: 110 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {r.team.flag_url && <img src={r.team.flag_url} alt={r.team.name} style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} onError={e => e.target.style.display="none"} />}
                            <span style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap" }}>{r.team.name}</span>
                          </div>
                        </td>
                        {[r.played, r.won, r.drawn, r.lost, r.goals_for, r.goals_against, r.goal_diff].map((v, j) => (
                          <td key={j} style={{ padding: "7px 8px", color: j === 6 ? (v > 0 ? "#10b981" : v < 0 ? "#ee1e46" : "rgba(255,255,255,.5)") : "rgba(255,255,255,.5)", fontSize: "0.8rem", textAlign: "right", fontWeight: j === 6 ? 700 : 400 }}>{v > 0 && j === 6 ? `+${v}` : v}</td>
                        ))}
                        <td style={{ padding: "7px 12px 7px 8px", color: "#fff", fontSize: "0.9rem", fontWeight: 900, textAlign: "right" }}>{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
