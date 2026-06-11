import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

const inputStyle = { width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: "0.88rem", outline: "none" }
const labelStyle = { display: "block", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }

function RoleBadge({ role }) {
  const isAdmin = role === "admin"
  return (
    <span style={{
      background: isAdmin ? "rgba(139,92,246,.15)" : "rgba(255,255,255,.06)",
      color: isAdmin ? "#a78bfa" : "rgba(255,255,255,.4)",
      border: isAdmin ? "1px solid rgba(139,92,246,.3)" : "1px solid rgba(255,255,255,.1)",
      borderRadius: 20, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700,
    }}>
      {role}
    </span>
  )
}

export default function AdminUsersPage() {
  const { authFetch, user: me } = useAuthContext()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)
  const [search,  setSearch]  = useState("")
  const [roleF,   setRoleF]   = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "user" })
  const [creating,   setCreating]   = useState(false)
  const [createError, setCreateError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving,  setSaving]  = useState(false)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = () => {
    setLoading(true)
    authFetch("/api/v1/admin/users").then(r => r.json()).then(setUsers).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = users.filter(u =>
    (!roleF   || u.role === roleF) &&
    (!search  || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  )

  const toggleRole = async (u) => {
    const newRole = u.role === "admin" ? "user" : "admin"
    const res = await authFetch(`/api/v1/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role: newRole }) })
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

  const openEdit = (u) => {
    setEditing(u)
    setEditForm({ name: u.name, email: u.email, role: u.role, password: "", password_confirmation: "" })
  }

  const saveEdit = async () => {
    setSaving(true)
    const body = { name: editForm.name, email: editForm.email, role: editForm.role }
    if (editForm.password) { body.password = editForm.password; body.password_confirmation = editForm.password_confirmation }
    const res = await authFetch(`/api/v1/admin/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) })
    const data = await res.json()
    if (res.ok) {
      setUsers(us => us.map(u => u.id === editing.id ? { ...u, ...data } : u))
      showToast(`✓ ${data.name || editing.name} updated`)
      setEditing(null)
    } else {
      showToast(`⚠ ${(data.errors || [data.error]).join(", ")}`, false)
    }
    setSaving(false)
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

  const adminCount = users.filter(u => u.role === "admin").length

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: toast.ok ? "#10b981" : "#ee1e46", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, zIndex: 2000, fontSize: "0.88rem" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Users</h1>
          <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.82rem", margin: "4px 0 0" }}>
            {users.length} total · {adminCount} admin{adminCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.85rem", outline: "none", width: 200 }}
          />
          <select value={roleF} onChange={e => setRoleF(e.target.value)} style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.85rem" }}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <button onClick={() => setShowCreate(v => !v)} style={{ background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap" }}>
            + New user
          </button>
        </div>
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

      {/* Table */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.03)" }}>
                {["Name", "Email", "Role", "Sign-ins", "Last seen", "Created", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.72rem", textAlign: "left", textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "12px 16px", color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>
                    {u.name}
                    {u.id === me?.id && <span style={{ marginLeft: 6, fontSize: "0.68rem", color: "rgba(255,255,255,.3)" }}>(you)</span>}
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.5)", fontSize: "0.82rem" }}>{u.email}</td>
                  <td style={{ padding: "12px 16px" }}><RoleBadge role={u.role} /></td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.4)", fontSize: "0.82rem", textAlign: "center" }}>{u.sign_in_count ?? 0}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.35)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,.25)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(u)} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
                        Edit
                      </button>
                      {u.id !== me?.id && (
                        <>
                          <button onClick={() => toggleRole(u)} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
                            {u.role === "admin" ? "→ user" : "→ admin"}
                          </button>
                          <button onClick={() => deleteUser(u)} style={{ background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.2)", color: "#ee1e46", borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer" }}>
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,.3)" }}>
              {users.length === 0 ? "No users yet" : "No users match your search"}
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setEditing(null)}>
          <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "28px", width: "100%", maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: "#fff", margin: "0 0 20px", fontSize: "1.1rem" }}>Edit user</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={labelStyle}>Name</label><input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Email</label><input type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} style={inputStyle} /></div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Role</label>
              <select value={editForm.role} onChange={e => setEditForm(f => ({...f, role: e.target.value}))} style={inputStyle} disabled={editing.id === me?.id}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
              {editing.id === me?.id && <p style={{ color: "rgba(255,255,255,.25)", fontSize: "0.72rem", margin: "4px 0 0" }}>Cannot change your own role</p>}
            </div>
            <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: "14px", marginBottom: 16 }}>
              <p style={{ color: "rgba(255,255,255,.35)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", margin: "0 0 10px" }}>Reset password (optional)</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={labelStyle}>New password</label><input type="password" minLength={8} value={editForm.password} onChange={e => setEditForm(f => ({...f, password: e.target.value}))} placeholder="Leave blank to keep" style={inputStyle} /></div>
                <div><label style={labelStyle}>Confirm</label><input type="password" value={editForm.password_confirmation} onChange={e => setEditForm(f => ({...f, password_confirmation: e.target.value}))} style={inputStyle} /></div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: "0.9rem", cursor: saving ? "default" : "pointer" }}>
                {saving ? "Saving…" : "Save changes"}
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
