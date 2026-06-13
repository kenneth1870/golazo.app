import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

function timeAgo(iso) {
  if (!iso) return "—"
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)      return "just now"
  if (diff < 3600)    return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400)   return `${Math.floor(diff / 3600)} h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)} d ago`
  return new Date(iso).toLocaleDateString()
}

const OS_ICON = { iOS: "🍎", Android: "🤖", Windows: "🪟", macOS: "💻", Linux: "🐧", Unknown: "❓" }

export default function AdminDevicesPage() {
  const { authFetch } = useAuthContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    authFetch("/api/v1/admin/devices")
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ summary: {}, devices: [] }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const summary = data?.summary || {}
  const devices = data?.devices || []

  const stats = [
    { label: "Total devices",      value: summary.total ?? 0,        color: "#3b82f6" },
    { label: "Active today",       value: summary.active_today ?? 0, color: "#10b981" },
    { label: "Active last 7 days", value: summary.active_7d ?? 0,    color: "#8b5cf6" },
    { label: "Push enabled",       value: summary.push_enabled ?? 0, color: "#f59e0b" },
    { label: "Total sessions",     value: summary.total_sessions ?? 0, color: "#ec4899" },
    { label: "Avg engagement",     value: fmtSecs(summary.avg_engaged_seconds), color: "#14b8a6" },
  ]

  const th = { padding: "12px 16px", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid rgba(255,255,255,.08)", textAlign: "left", color: "rgba(255,255,255,.4)" }
  const td = { padding: "11px 16px" }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Devices & Usage</h1>
        <button onClick={load} style={{
          marginLeft: "auto", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 8, padding: "6px 12px", color: "rgba(255,255,255,.7)", fontSize: "0.78rem", cursor: "pointer",
        }}>↻ Refresh</button>
      </div>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 24, fontSize: "0.85rem" }}>
        Every device that has opened the app — engagement, sessions and last activity.
      </p>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: "#161b22", border: "1px solid rgba(255,255,255,.07)",
            borderTop: `3px solid ${s.color}`, borderRadius: 10, padding: "16px 18px",
          }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff" }}>{s.value}</div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.76rem", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Breakdown chips */}
      {(summary.by_os || summary.by_locale) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 24 }}>
          {summary.by_os && (
            <Breakdown title="By OS" entries={Object.entries(summary.by_os)} icon={k => OS_ICON[k] || "❓"} />
          )}
          {summary.by_locale && (
            <Breakdown title="By language" entries={Object.entries(summary.by_locale)} icon={() => "🌐"} />
          )}
        </div>
      )}

      {/* Device table */}
      {loading ? (
        <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
      ) : devices.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.85rem" }}>No device activity recorded yet.</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 820 }}>
            <thead>
              <tr>
                {["Device", "Lang", "Push", "Sessions", "Engaged", "Last screen", "Last active", "First seen"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} style={{ color: "#fff", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={td}>{OS_ICON[d.os] || "❓"} {d.browser} · {d.os}</td>
                  <td style={td}><span style={{ background: "rgba(255,255,255,.08)", borderRadius: 5, padding: "2px 7px", fontSize: "0.72rem", textTransform: "uppercase" }}>{d.locale || "—"}</span></td>
                  <td style={td}>{d.push_enabled ? <span style={{ color: "#10b981" }}>✓</span> : <span style={{ color: "rgba(255,255,255,.25)" }}>—</span>}</td>
                  <td style={td}>{d.visit_count}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{d.engaged_human}</td>
                  <td style={{ ...td, color: "rgba(255,255,255,.55)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.last_path || "—"}</td>
                  <td style={{ ...td, color: "rgba(255,255,255,.55)" }}>{timeAgo(d.last_seen_at)}</td>
                  <td style={{ ...td, color: "rgba(255,255,255,.4)" }}>{timeAgo(d.first_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Breakdown({ title, entries, icon }) {
  return (
    <div>
      <div style={{ color: "rgba(255,255,255,.35)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {entries.map(([k, v]) => (
          <span key={k} style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "5px 11px", color: "#fff", fontSize: "0.8rem" }}>
            {icon(k)} {k} <strong style={{ marginLeft: 4 }}>{v}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function fmtSecs(s) {
  s = Number(s) || 0
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60)   return `${Math.floor(s / 60)}m`
  return `${s}s`
}
