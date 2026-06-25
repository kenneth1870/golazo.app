import { useState, useEffect, useCallback, useRef } from "react"
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

function fmtSecs(s) {
  s = Number(s) || 0
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  if (s >= 60)   return `${Math.floor(s / 60)}m`
  return `${s}s`
}

const OS_ICON = { iOS: "🍎", Android: "🤖", Windows: "🪟", macOS: "💻", Linux: "🐧", Unknown: "❓" }

function countryFlag(code) {
  if (!code || code.length !== 2) return "🌍"
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  )
}

function geoLabel(d) {
  if (!d.country && !d.city) return null
  const parts = []
  if (d.city) parts.push(d.city)
  if (d.country) parts.push(d.country)
  return parts.join(", ")
}

const btn = {
  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 6, padding: "4px 9px", color: "rgba(255,255,255,.6)",
  fontSize: "0.72rem", cursor: "pointer", whiteSpace: "nowrap",
}
const ctrl = {
  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: "0.82rem", outline: "none",
}

export default function AdminDevicesPage() {
  const { authFetch } = useAuthContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedIp, setExpandedIp] = useState(null)
  const [toast, setToast] = useState(null)

  // Filters + pagination
  const [q, setQ] = useState("")
  const [os, setOs] = useState("")
  const [country, setCountry] = useState("")
  const [pushOnly, setPushOnly] = useState(false)
  const [blockedOnly, setBlockedOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [pushTarget, setPushTarget] = useState(null) // device for the push modal

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const queryString = useCallback(() => {
    const p = new URLSearchParams()
    if (q.trim())     p.set("q", q.trim())
    if (os)           p.set("os", os)
    if (country)      p.set("country", country)
    if (pushOnly)     p.set("push", "1")
    if (blockedOnly)  p.set("blocked", "1")
    p.set("page", String(page))
    return p.toString()
  }, [q, os, country, pushOnly, blockedOnly, page])

  const load = useCallback(() => {
    setLoading(true)
    authFetch(`/api/v1/admin/devices?${queryString()}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ summary: {}, devices: [], pagination: {} }))
      .finally(() => setLoading(false))
  }, [authFetch, queryString])

  // Reset to page 1 whenever a filter changes
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setPage(1)
  }, [q, os, country, pushOnly, blockedOnly]) // eslint-disable-line

  // Debounced fetch on any filter/page change
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const summary = data?.summary || {}
  const devices = data?.devices || []
  const pg = data?.pagination || { page: 1, total_pages: 1, total: 0 }

  const stats = [
    { label: "Total devices",      value: summary.total ?? 0,        color: "#3b82f6" },
    { label: "Active today",       value: summary.active_today ?? 0, color: "#10b981" },
    { label: "Active last 7 days", value: summary.active_7d ?? 0,    color: "#8b5cf6" },
    { label: "Push enabled",       value: summary.push_enabled ?? 0, color: "#f59e0b" },
    { label: "Blocked",            value: summary.blocked ?? 0,      color: "#ef4444" },
    { label: "Avg engagement",     value: fmtSecs(summary.avg_engaged_seconds), color: "#14b8a6" },
  ]

  const exportCsv = async () => {
    try {
      const res = await authFetch(`/api/v1/admin/devices/export?${queryString()}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `devices-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showToast("⚠ Export failed", false)
    }
  }

  const toggleBlock = async (d) => {
    const res = await authFetch(`/api/v1/admin/devices/${d.id}/block`, { method: "POST" })
    if (res.ok) {
      const updated = await res.json()
      setData(prev => ({ ...prev, devices: prev.devices.map(x => x.id === d.id ? updated : x) }))
      showToast(updated.blocked ? "🚫 Device blocked" : "✓ Device unblocked")
    } else {
      showToast("⚠ Failed", false)
    }
  }

  const deleteDevice = async (d) => {
    if (!window.confirm(`Delete this device?\n${d.browser} · ${d.os}\nAll its usage history will be removed.`)) return
    const res = await authFetch(`/api/v1/admin/devices/${d.id}`, { method: "DELETE" })
    if (res.ok) {
      setData(prev => ({ ...prev, devices: prev.devices.filter(x => x.id !== d.id) }))
      showToast("✓ Device deleted")
    } else {
      showToast("⚠ Could not delete", false)
    }
  }

  const th = {
    padding: "12px 16px", fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase",
    letterSpacing: ".04em", borderBottom: "1px solid rgba(255,255,255,.08)",
    textAlign: "left", color: "rgba(255,255,255,.4)",
  }
  const td = { padding: "11px 14px", verticalAlign: "middle" }

  const osOptions      = Object.keys(summary.by_os || {})
  const countryOptions = Object.keys(summary.by_country || {})
  const hasFilters = q || os || country || pushOnly || blockedOnly

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, background: toast.ok ? "#10b981" : "#ee1e46", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, zIndex: 2000, fontSize: "0.88rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Devices & Usage</h1>
        <button onClick={exportCsv} style={{ marginLeft: "auto", ...btn, padding: "6px 12px" }}>⤓ Export CSV</button>
        <button onClick={load} style={{ ...btn, padding: "6px 12px" }}>↻ Refresh</button>
      </div>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 24, fontSize: "0.85rem" }}>
        Every device that has opened the app — engagement, sessions, location and last activity.
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

      {/* Filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search city, country, IP, screen…"
          style={{ ...ctrl, minWidth: 240, flex: "1 1 240px" }}
        />
        <select value={os} onChange={e => setOs(e.target.value)} style={{ ...ctrl, background: "#161b22" }}>
          <option value="">All OS</option>
          {osOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...ctrl, background: "#161b22" }}>
          <option value="">All countries</option>
          {countryOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.55)", fontSize: "0.8rem", cursor: "pointer" }}>
          <input type="checkbox" checked={pushOnly} onChange={e => setPushOnly(e.target.checked)} /> Push only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.55)", fontSize: "0.8rem", cursor: "pointer" }}>
          <input type="checkbox" checked={blockedOnly} onChange={e => setBlockedOnly(e.target.checked)} /> Blocked only
        </label>
        {hasFilters && (
          <button onClick={() => { setQ(""); setOs(""); setCountry(""); setPushOnly(false); setBlockedOnly(false) }} style={btn}>
            Clear filters
          </button>
        )}
      </div>

      {/* Device table */}
      {loading ? (
        <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
      ) : devices.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.85rem" }}>
          {hasFilters ? "No devices match these filters." : "No device activity recorded yet."}
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto", background: "#161b22", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: 1040 }}>
              <thead>
                <tr>
                  {["Device", "Location", "Lang", "Push", "Sessions", "Engaged", "Last screen", "Last active", "First seen", "Actions"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map(d => {
                  const geo = geoLabel(d)
                  const isExpanded = expandedIp === d.id
                  return (
                    <tr key={d.id} style={{ color: "#fff", borderBottom: "1px solid rgba(255,255,255,.05)", opacity: d.blocked ? 0.55 : 1 }}>
                      <td style={td}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {OS_ICON[d.os] || "❓"} {d.browser} · {d.os}
                          {d.blocked && <span style={{ marginLeft: 6, color: "#ef4444", fontSize: "0.68rem", fontWeight: 700 }}>BLOCKED</span>}
                        </span>
                      </td>
                      <td style={td}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {geo && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                              {countryFlag(d.country)} {d.city || d.region || "—"}{d.country ? `, ${d.country}` : ""}
                            </span>
                          )}
                          {d.ip_address ? (
                            <button
                              onClick={() => setExpandedIp(isExpanded ? null : d.id)}
                              title={isExpanded ? "Hide IP" : "Show IP"}
                              style={{
                                background: "none", border: "none", padding: 0, cursor: "pointer",
                                color: isExpanded ? "#fff" : "rgba(255,255,255,.3)",
                                fontSize: "0.7rem", textAlign: "left", fontFamily: "monospace", letterSpacing: "0.02em",
                              }}
                            >
                              {isExpanded ? d.ip_address : "···.···.···"}
                            </button>
                          ) : (
                            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.2)" }}>—</span>
                          )}
                        </div>
                      </td>
                      <td style={td}>
                        <span style={{ background: "rgba(255,255,255,.08)", borderRadius: 5, padding: "2px 7px", fontSize: "0.72rem", textTransform: "uppercase" }}>
                          {d.locale || "—"}
                        </span>
                      </td>
                      <td style={td}>{d.push_enabled ? <span style={{ color: "#10b981" }}>✓</span> : <span style={{ color: "rgba(255,255,255,.25)" }}>—</span>}</td>
                      <td style={td}>{d.visit_count}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{d.engaged_human}</td>
                      <td style={{ ...td, color: "rgba(255,255,255,.55)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.last_path || "—"}
                      </td>
                      <td style={{ ...td, color: "rgba(255,255,255,.55)", whiteSpace: "nowrap" }}>{timeAgo(d.last_seen_at)}</td>
                      <td style={{ ...td, color: "rgba(255,255,255,.4)", whiteSpace: "nowrap" }}>{timeAgo(d.first_seen_at)}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 5 }}>
                          {d.push_enabled && (
                            <button onClick={() => setPushTarget(d)} style={btn} title="Send push to this device">🔔</button>
                          )}
                          <button onClick={() => toggleBlock(d)} style={btn} title={d.blocked ? "Unblock" : "Block"}>
                            {d.blocked ? "↺" : "🚫"}
                          </button>
                          <button onClick={() => deleteDevice(d)} style={{ ...btn, color: "#ee1e46", borderColor: "rgba(238,30,70,.25)" }} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, color: "rgba(255,255,255,.4)", fontSize: "0.8rem" }}>
            <span>{pg.total} device{pg.total !== 1 ? "s" : ""}{hasFilters ? " matched" : ""}</span>
            {pg.total_pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pg.page <= 1} style={{ ...btn, opacity: pg.page <= 1 ? 0.4 : 1 }}>‹ Prev</button>
                <span>Page {pg.page} / {pg.total_pages}</span>
                <button onClick={() => setPage(p => Math.min(pg.total_pages, p + 1))} disabled={pg.page >= pg.total_pages} style={{ ...btn, opacity: pg.page >= pg.total_pages ? 0.4 : 1 }}>Next ›</button>
              </div>
            )}
          </div>
        </>
      )}

      {pushTarget && (
        <PushModal device={pushTarget} authFetch={authFetch} onClose={() => setPushTarget(null)} onSent={showToast} />
      )}
    </div>
  )
}

function PushModal({ device, authFetch, onClose, onSent }) {
  const [title, setTitle] = useState("")
  const [body, setBody]   = useState("")
  const [url, setUrl]     = useState("/")
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!title.trim()) return
    setSending(true)
    const res = await authFetch(`/api/v1/admin/devices/${device.id}/push`, {
      method: "POST",
      body: JSON.stringify({ title, body, url }),
    })
    const d = await res.json().catch(() => ({}))
    setSending(false)
    if (res.ok) {
      onSent(`✓ Sent to ${d.sent ?? 1} endpoint${d.sent === 1 ? "" : "s"}`)
      onClose()
    } else {
      onSent(`⚠ ${d.error || "Failed to send"}`, false)
    }
  }

  const field = { width: "100%", boxSizing: "border-box", ...ctrl, marginTop: 4 }
  const lbl = { color: "rgba(255,255,255,.4)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: 28, width: "100%", maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#fff", margin: "0 0 4px", fontSize: "1.1rem" }}>Send push</h3>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: "0.8rem", margin: "0 0 18px" }}>
          To {OS_ICON[device.os] || "❓"} {device.browser} · {device.os}
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} style={field} autoFocus />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Body</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={500} rows={3} style={{ ...field, resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Link (URL)</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="/" style={field} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={send} disabled={sending || !title.trim()} style={{ flex: 1, background: "#ee1e46", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: "0.9rem", cursor: sending || !title.trim() ? "default" : "pointer", opacity: !title.trim() ? 0.5 : 1 }}>
            {sending ? "Sending…" : "Send"}
          </button>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
