import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"]
const CONFS  = ["UEFA","CONMEBOL","CONCACAF","CAF","AFC","OFC"]

export default function AdminTeamsPage() {
  const { authFetch } = useAuthContext()
  const [teams,   setTeams]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState("")
  const [groupF,  setGroupF]  = useState("")
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState(null)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    authFetch("/api/v1/admin/teams").then(r => r.json()).then(setTeams).finally(() => setLoading(false))
  }, [])

  const openEdit = (t) => { setEditing(t); setForm({ name: t.name, code: t.code, group: t.group || "", confederation: t.confederation || "", flag_url: t.flag_url || "" }) }

  const save = async () => {
    setSaving(true)
    const res = await authFetch(`/api/v1/admin/teams/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) })
    if (res.ok) {
      const updated = await res.json()
      setTeams(ts => ts.map(t => t.id === updated.id ? { ...t, ...updated } : t))
      showToast(`✓ ${updated.name} saved`)
      setEditing(null)
    } else {
      const d = await res.json()
      showToast(`⚠ ${(d.errors || [d.error]).join(", ")}`, false)
    }
    setSaving(false)
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: "0.88rem", outline: "none" }
  const labelStyle = { display: "block", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }

  const filtered = teams.filter(t =>
    (!groupF || t.group === groupF) &&
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase()))
  )

  const byGroup = filtered.reduce((acc, t) => {
    const g = t.group || "—"
    ;(acc[g] = acc[g] || []).push(t)
    return acc
  }, {})

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: toast.ok ? "#10b981" : "#ee1e46", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, zIndex: 2000, fontSize: "0.88rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Teams</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.82rem", margin: "4px 0 0" }}>{teams.length} total · {Object.keys(byGroup).length} groups</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search team…"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.85rem", outline: "none", width: 180 }}
          />
          <select value={groupF} onChange={e => setGroupF(e.target.value)} style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.85rem" }}>
            <option value="">All groups</option>
            {GROUPS.map(g => <option key={g} value={g}>Group {g}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        Object.entries(byGroup).sort(([a],[b]) => a.localeCompare(b)).map(([group, groupTeams]) => (
          <div key={group} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ background: "#ee1e46", color: "#fff", fontWeight: 800, fontSize: "0.75rem", borderRadius: 6, padding: "3px 10px", letterSpacing: ".06em" }}>
                GROUP {group}
              </div>
              <span style={{ color: "rgba(255,255,255,.25)", fontSize: "0.72rem" }}>{groupTeams.length} teams</span>
            </div>
            <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,.03)" }}>
                    {["Team", "Code", "Confederation", "Played", ""].map(h => (
                      <th key={h} style={{ padding: "8px 14px", color: "rgba(255,255,255,.4)", fontSize: "0.7rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupTeams.map(t => (
                    <tr key={t.id} style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {t.flag_url && <img src={t.flag_url} alt="" style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 2 }} onError={e => e.target.style.display="none"} />}
                          <span style={{ color: "#fff", fontWeight: 600, fontSize: "0.88rem" }}>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.4)", fontSize: "0.82rem", fontFamily: "monospace" }}>{t.code}</td>
                      <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.4)", fontSize: "0.78rem" }}>{t.confederation || "—"}</td>
                      <td style={{ padding: "10px 14px", color: "rgba(255,255,255,.4)", fontSize: "0.82rem" }}>{t.matches_played}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <button onClick={() => openEdit(t)} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", borderRadius: 6, padding: "4px 12px", fontSize: "0.75rem", cursor: "pointer" }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setEditing(null)}>
          <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "28px", width: "100%", maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              {form.flag_url && <img src={form.flag_url} alt="" style={{ width: 32, height: 22, objectFit: "cover", borderRadius: 3 }} />}
              <h3 style={{ color: "#fff", margin: 0 }}>{editing.name}</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Name</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Code (3)</label><input maxLength={3} value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value.toUpperCase()}))} style={inputStyle} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Group</label>
                <select value={form.group} onChange={e => setForm(f => ({...f, group: e.target.value}))} style={inputStyle}>
                  <option value="">—</option>
                  {GROUPS.map(g => <option key={g} value={g}>Group {g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Confederation</label>
                <select value={form.confederation} onChange={e => setForm(f => ({...f, confederation: e.target.value}))} style={inputStyle}>
                  <option value="">—</option>
                  {CONFS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}><label style={labelStyle}>Flag URL</label><input value={form.flag_url} onChange={e => setForm(f => ({...f, flag_url: e.target.value}))} style={inputStyle} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={save} disabled={saving} style={{ flex: 1, background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: "0.9rem", cursor: saving ? "default" : "pointer" }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setEditing(null)} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
