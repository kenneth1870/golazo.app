import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

const STATUS_COLORS = {
  live:      { bg: "rgba(238,30,70,.15)",  color: "#ee1e46",  border: "rgba(238,30,70,.3)" },
  finished:  { bg: "rgba(16,185,129,.1)",  color: "#10b981",  border: "rgba(16,185,129,.25)" },
  scheduled: { bg: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", border: "rgba(255,255,255,.1)" },
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.scheduled
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
    }}>
      {status}
    </span>
  )
}

function EditModal({ match, onClose, onSave }) {
  const [form, setForm] = useState({
    status:     match.status,
    home_score: match.home_score ?? "",
    away_score: match.away_score ?? "",
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    await onSave(match.id, form)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#161b22", border: "1px solid rgba(255,255,255,.1)",
        borderRadius: 14, padding: "28px 28px", width: "100%", maxWidth: 420,
      }}>
        <h3 style={{ color: "#fff", margin: "0 0 4px" }}>
          {match.home_team?.name || match.home_slot || "TBD"} vs {match.away_team?.name || match.away_slot || "TBD"}
        </h3>
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.8rem", marginBottom: 20 }}>
          Edit match status and score
        </p>

        <label style={labelStyle}>STATUS</label>
        <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
          <option value="scheduled">scheduled</option>
          <option value="live">live</option>
          <option value="finished">finished</option>
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <label style={labelStyle}>{match.home_team?.name || match.home_slot || "Home"} score</label>
            <input type="number" min="0" max="99" value={form.home_score} onChange={e => set("home_score", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{match.away_team?.name || match.away_slot || "Away"} score</label>
            <input type="number" min="0" max="99" value={form.away_score} onChange={e => set("away_score", e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving…" : "Save"}</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: "0.9rem", outline: "none", marginTop: 4 }
const labelStyle = { display: "block", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }
const btnPrimary = { background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", flex: 1 }
const btnSecondary = { background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "9px 20px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", flex: 1 }

export default function AdminMatchesPage() {
  const { authFetch } = useAuthContext()
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState("all")
  const [editing,  setEditing]  = useState(null)
  const [toast,    setToast]    = useState(null)

  const load = () => {
    setLoading(true)
    authFetch("/api/v1/admin/matches")
      .then(r => r.json())
      .then(setMatches)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const saveMatch = async (id, form) => {
    const res = await authFetch(`/api/v1/admin/matches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(form),
    })
    const updated = await res.json()
    if (res.ok) {
      setMatches(ms => ms.map(m => m.id === id ? updated : m))
      setToast("✓ Match updated")
      setTimeout(() => setToast(null), 3000)
    }
  }

  const filtered = filter === "all" ? matches : matches.filter(m => m.status === filter)

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: "#10b981", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, zIndex: 2000, fontSize: "0.88rem" }}>
          {toast}
        </div>
      )}
      {editing && <EditModal match={editing} onClose={() => setEditing(null)} onSave={saveMatch} />}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Matches</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.82rem", margin: "4px 0 0" }}>
            {matches.length} total
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "live", "scheduled", "finished"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "#ee1e46" : "rgba(255,255,255,.07)",
              color: filter === f ? "#fff" : "rgba(255,255,255,.5)",
              border: "none", borderRadius: 6, padding: "6px 14px",
              fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.03)" }}>
                {["Match", "Date", "Score", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>
                    {m.home_team?.name || m.home_slot || "TBD"} vs {m.away_team?.name || m.away_slot || "TBD"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {m.kickoff_at ? new Date(m.kickoff_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>
                    {m.status !== "scheduled" ? `${m.home_score ?? "—"} – ${m.away_score ?? "—"}` : "vs"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={m.status} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => setEditing(m)}
                      style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", borderRadius: 6, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,.3)" }}>No matches found</div>
          )}
        </div>
      )}
    </div>
  )
}
