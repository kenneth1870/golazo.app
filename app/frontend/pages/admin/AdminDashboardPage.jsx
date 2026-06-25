import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

function fmtSecs(s) {
  s = Number(s) || 0
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60)   return `${Math.floor(s / 60)}m`
  return `${s}s`
}

// Simple inline bar chart for the new-devices-per-day series.
function BarChart({ series = [] }) {
  const max = Math.max(1, ...series.map(p => p.count))
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90, padding: "0 2px" }}>
      {series.map((p, i) => {
        const h = Math.round((p.count / max) * 100)
        const d = new Date(p.date + "T00:00:00")
        return (
          <div key={i} title={`${p.date}: ${p.count} new`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", display: "flex", alignItems: "flex-end", height: "100%" }}>
              <div style={{ width: "100%", height: `${Math.max(h, p.count > 0 ? 6 : 2)}%`, background: p.count > 0 ? "#3b82f6" : "rgba(255,255,255,.08)", borderRadius: "3px 3px 0 0", transition: "height .3s" }} />
            </div>
            <span style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)" }}>{d.getDate()}</span>
          </div>
        )
      })}
    </div>
  )
}

function Stat({ icon, label, value, color = "#ee1e46" }) {
  return (
    <div style={{
      background: "#161b22", border: "1px solid rgba(255,255,255,.07)",
      borderRadius: 12, padding: "20px 24px",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: "#fff" }}>{value ?? "—"}</div>
      <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.8rem", marginTop: 4 }}>{label}</div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const { authFetch } = useAuthContext()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [healing, setHealing]   = useState(false)
  const [healMsg, setHealMsg]   = useState(null)

  useEffect(() => {
    authFetch("/api/v1/admin")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function triggerHeal() {
    setHealing(true)
    setHealMsg(null)
    try {
      const res = await authFetch("/api/v1/admin/matches/heal", { method: "POST" })
      const json = await res.json()
      setHealMsg(json.message || "Heal job enqueued")
    } catch {
      setHealMsg("Error — check server logs")
    } finally {
      setHealing(false)
    }
  }

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>

  return (
    <div>
      <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 28, fontSize: "0.85rem" }}>
        Golazo app overview
      </p>

      {/* Heal button */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={triggerHeal}
          disabled={healing}
          style={{
            background: healing ? "rgba(238,30,70,.4)" : "#ee1e46",
            border: "none", borderRadius: 8, padding: "10px 20px",
            color: "#fff", fontWeight: 700, fontSize: "0.85rem",
            cursor: healing ? "not-allowed" : "pointer", letterSpacing: ".03em",
          }}
        >
          {healing ? "⏳ Healing…" : "🔧 Heal All Match Data"}
        </button>
        {healMsg && (
          <span style={{ color: "#10b981", fontSize: "0.8rem" }}>{healMsg}</span>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
        <Stat icon="👥" label="Total users"       value={data?.users}            color="#3b82f6" />
        <Stat icon="🛡️" label="Admins"            value={data?.admins}           color="#8b5cf6" />
        <Stat icon="🔔" label="Push subscribers"  value={data?.push_subscribers} color="#10b981" />
        <Stat icon="🔴" label="Live matches"       value={data?.live_matches}     color="#ee1e46" />
        <Stat icon="📅" label="Total matches"      value={data?.total_matches}    color="#f59e0b" />
        <Stat icon="🎯" label="Predictions"        value={data?.predictions}      color="#06b6d4" />
        <Stat icon="📰" label="News articles"      value={data?.news_articles}    color="#84cc16" />
      </div>

      {/* Usage analytics */}
      {data?.devices && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 800, margin: "0 0 14px" }}>Usage</h2>

          {/* Device activity stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 16, marginBottom: 20 }}>
            <Stat icon="📱" label="Total devices"     value={data.devices.total}                     color="#3b82f6" />
            <Stat icon="🟢" label="Active today"      value={data.devices.active_today}              color="#10b981" />
            <Stat icon="📆" label="Active last 7d"    value={data.devices.active_7d}                 color="#8b5cf6" />
            <Stat icon="🔁" label="Total sessions"    value={data.devices.total_sessions}            color="#ec4899" />
            <Stat icon="⏱️" label="Avg engagement"    value={fmtSecs(data.devices.avg_engaged_seconds)} color="#14b8a6" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 16 }}>
            {/* New devices per day */}
            <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "18px 20px" }}>
              <h3 style={{ color: "#fff", margin: "0 0 14px", fontSize: "0.95rem" }}>
                New devices <span style={{ color: "rgba(255,255,255,.35)", fontWeight: 400, fontSize: "0.8rem" }}>· last 14 days</span>
              </h3>
              <BarChart series={data.devices.new_per_day || []} />
            </div>

            {/* Top screens */}
            <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "18px 20px" }}>
              <h3 style={{ color: "#fff", margin: "0 0 14px", fontSize: "0.95rem" }}>
                Top screens <span style={{ color: "rgba(255,255,255,.35)", fontWeight: 400, fontSize: "0.8rem" }}>· where devices are</span>
              </h3>
              {(data.devices.top_screens || []).length === 0 ? (
                <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.82rem", margin: 0 }}>No data yet</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.devices.top_screens.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ color: "rgba(255,255,255,.7)", fontSize: "0.8rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.path}</span>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.82rem", background: "rgba(255,255,255,.06)", borderRadius: 6, padding: "1px 8px" }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent users */}
      {data?.recent_users?.length > 0 && (
        <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.07)" }}>
            <h3 style={{ color: "#fff", margin: 0, fontSize: "1rem" }}>Recent sign-ups</h3>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.03)" }}>
                {["Name", "Email", "Role"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.75rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent_users.map(u => (
                <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#fff", fontSize: "0.88rem" }}>{u.name}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.5)", fontSize: "0.85rem" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: u.role === "admin" ? "rgba(139,92,246,.15)" : "rgba(255,255,255,.06)",
                      color: u.role === "admin" ? "#a78bfa" : "rgba(255,255,255,.4)",
                      border: u.role === "admin" ? "1px solid rgba(139,92,246,.3)" : "1px solid rgba(255,255,255,.1)",
                      borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700,
                    }}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
