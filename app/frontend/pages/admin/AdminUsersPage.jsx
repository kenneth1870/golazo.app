import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

export default function AdminUsersPage() {
  const { authFetch, user: me } = useAuthContext()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "user" })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const load = () => {
    setLoading(true)
    authFetch("/api/v1/admin/users").then(r => r.json()).then(setUsers).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const toggleRole = async (u) => {
    const newRole = u.role === "admin" ? "user" : "admin"
    const res = await authFetch(`/api/v1/admin/users/${u.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers(us => us.map(x => x.id === u.id ? { ...x, role: newRole } : x))
      showToast(`✓ ${u.name} is now ${newRole}`)
    } else {
      const d = await res.json()
      showToast(`⚠ ${d.error || "Failed"}`, false)
    }
  }

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name} (${u.email})?`)) return
    const res = await authFetch(`/api/v1/admin/users/${u.id}`, { method: "DELETE" })
    if (res.ok) {
      setUsers(us => us.filter(x => x.id !== u.id))
      showToast(`✓ ${u.name} deleted`)
    } else {
      showToast("⚠ Could not delete", false)
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    const res = await authFetch("/api/v1/sessions/register", {
      method: "POST",
      body: JSON.stringify({ ...createForm, password_confirmation: createForm.password }),
    })
    const data = await res.json()
    if (res.ok) {
      showToast(`✓ ${createForm.name} created`)
      setShowCreate(false)
      setCreateForm({ name: "", email: "", password: "", role: "user" })
      load()
    } else {
      setCreateError((data.errors || [data.error]).join(", "))
    }
    setCreating(false)
  }

  const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: "0.88rem", outline: "none" }
  const labelStyle = { display: "block", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: toast.ok ? "#10b981" : "#ee1e46", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, zIndex: 2000, fontSize: "0.88rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Users</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.82rem", margin: "4px 0 0" }}>{users.length} total</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)} style={{ background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
          + New user
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "20px 24px", marginBottom: 24, maxWidth: 480 }}>
          <h3 style={{ color: "#fff", margin: "0 0 16px", fontSize: "1rem" }}>Create user</h3>
          <form onSubmit={createUser}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Name</label><input required value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Email</label><input required type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div><label style={labelStyle}>Password</label><input required type="password" minLength={8} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            {createError && <p style={{ color: "#f87171", fontSize: "0.8rem", marginBottom: 12 }}>⚠ {createError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={creating} style={{ background: "#ee1e46", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: creating ? "default" : "pointer" }}>
                {creating ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 7, padding: "8px 14px", cursor: "pointer", fontSize: "0.85rem" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.03)" }}>
                {["Name", "Email", "Role", "Sign-ins", "Last seen", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>
                    {u.name}
                    {u.id === me?.id && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "rgba(255,255,255,.3)" }}>(you)</span>}
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.5)", fontSize: "0.82rem" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      background: u.role === "admin" ? "rgba(139,92,246,.15)" : "rgba(255,255,255,.06)",
                      color: u.role === "admin" ? "#a78bfa" : "rgba(255,255,255,.4)",
                      border: u.role === "admin" ? "1px solid rgba(139,92,246,.3)" : "1px solid rgba(255,255,255,.1)",
                      borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.82rem" }}>{u.sign_in_count ?? 0}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.35)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {u.id !== me?.id && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleRole(u)} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
                          {u.role === "admin" ? "→ user" : "→ admin"}
                        </button>
                        <button onClick={() => deleteUser(u)} style={{ background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.2)", color: "#ee1e46", borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,.3)" }}>No users yet</div>
          )}
        </div>
      )}
    </div>
  )
}
