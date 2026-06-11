import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

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
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch("/api/v1/admin")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>

  return (
    <div>
      <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 28, fontSize: "0.85rem" }}>
        Golazo app overview
      </p>

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
