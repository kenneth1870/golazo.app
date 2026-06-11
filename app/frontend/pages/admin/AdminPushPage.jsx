import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

export default function AdminPushPage() {
  const { authFetch } = useAuthContext()
  const [stats,    setStats]    = useState(null)
  const [form,     setForm]     = useState({ title: "", body: "", url: "/", team_name: "" })
  const [sending,  setSending]  = useState(false)
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    authFetch("/api/v1/admin/push").then(r => r.json()).then(setStats).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const send = async (e) => {
    e.preventDefault()
    setSending(true)
    setResult(null)
    try {
      const res = await authFetch("/api/v1/admin/push/broadcast", {
        method: "POST",
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: "Request failed" })
    } finally {
      setSending(false)
    }
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: "0.9rem", outline: "none",
  }
  const labelStyle = { display: "block", color: "rgba(255,255,255,.45)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 5 }

  return (
    <div>
      <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 6 }}>Push Notifications</h1>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 28, fontSize: "0.85rem" }}>
        Send notifications to all subscribers or a specific team's followers
      </p>

      {/* Stats */}
      {stats && (
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "Total subscribers", value: stats.total,      color: "#3b82f6" },
            { label: "Following a team",  value: stats.with_teams, color: "#10b981" },
            { label: "Global (no team)",  value: stats.global,     color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#161b22", border: `1px solid rgba(255,255,255,.07)`,
              borderTop: `3px solid ${s.color}`,
              borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 140,
            }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.78rem", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast form */}
      <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "28px 28px", maxWidth: 540 }}>
        <h3 style={{ color: "#fff", margin: "0 0 20px", fontSize: "1.1rem" }}>Broadcast message</h3>
        <form onSubmit={send}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} required placeholder="⚽ Goal! Argentina 1–0 France" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Body</label>
            <input value={form.body} onChange={e => set("body", e.target.value)} placeholder="Messi, 34'" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Link URL</label>
            <input value={form.url} onChange={e => set("url", e.target.value)} placeholder="/matches/12345" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Team filter (optional)</label>
            <input value={form.team_name} onChange={e => set("team_name", e.target.value)} placeholder="Argentina (leave blank to send to all)" style={inputStyle} />
            <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.72rem", marginTop: 5 }}>
              If set, only subscribers following this team will receive the notification.
            </p>
          </div>

          {result && (
            <div style={{
              background: result.error ? "rgba(238,30,70,.1)" : "rgba(16,185,129,.1)",
              border: `1px solid ${result.error ? "rgba(238,30,70,.3)" : "rgba(16,185,129,.3)"}`,
              borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: "0.85rem",
              color: result.error ? "#f87171" : "#34d399",
            }}>
              {result.error ? `⚠ ${result.error}` : `✓ Sent to ${result.sent} device${result.sent !== 1 ? "s" : ""}${result.failed > 0 ? ` (${result.failed} failed/removed)` : ""}`}
            </div>
          )}

          <button type="submit" disabled={sending} style={{
            background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8,
            padding: "11px 24px", fontWeight: 800, fontSize: "0.9rem",
            cursor: sending ? "default" : "pointer", opacity: sending ? 0.7 : 1,
          }}>
            {sending ? "Sending…" : "🔔 Send notification"}
          </button>
        </form>
      </div>
    </div>
  )
}
