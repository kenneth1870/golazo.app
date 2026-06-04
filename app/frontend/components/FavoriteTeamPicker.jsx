import { useState, useEffect, useRef } from "react"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"

export default function FavoriteTeamPicker() {
  const [fav, setFav]     = useFavoriteTeam()
  const [teams, setTeams] = useState([])
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    fetch("/api/v1/teams")
      .then(r => r.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onOutside)
    return () => document.removeEventListener("mousedown", onOutside)
  }, [])

  const filtered = teams.filter(t =>
    t.name?.toLowerCase().includes(query.toLowerCase())
  )

  function pick(team) {
    setFav({ id: team.id, name: team.name, flag_url: team.flag_url, group: team.group })
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "#fff",
          fontSize: "0.78rem", fontWeight: 600, transition: ".2s",
        }}
      >
        {fav ? (
          <>
            {fav.flag_url && <img src={fav.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display="none")} />}
            <span>{fav.name}</span>
            <span style={{ color: "var(--muted)", marginLeft: 2 }}>★</span>
          </>
        ) : (
          <span>★ Follow a team</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 12, width: 260, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        }}>
          <input
            autoFocus
            placeholder="Search team…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "7px 10px", color: "#fff", fontSize: "0.8rem", marginBottom: 8,
            }}
          />
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {fav && (
              <button
                onClick={() => { setFav(null); setOpen(false) }}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: "#ef4444", padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", marginBottom: 4 }}
              >
                ✕ Remove favorite
              </button>
            )}
            {filtered.map(t => (
              <button
                key={t.id}
                onClick={() => pick(t)}
                style={{
                  width: "100%", textAlign: "left", background: fav?.id === t.id ? "rgba(238,30,70,.15)" : "transparent",
                  border: "none", color: "#fff", padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                  fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {t.flag_url && <img src={t.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display="none")} />}
                <span>{t.name}</span>
                {t.group && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--muted)" }}>Grp {t.group}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", padding: "12px 0" }}>No teams found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
