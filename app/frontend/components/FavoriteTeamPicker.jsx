import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"

function FlagOrInitial({ src, name }) {
  const [err, setErr] = useState(false)
  if (src && !err) {
    return <img src={src} alt="" className="flag-xs" onError={() => setErr(true)} />
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 14, height: 14, borderRadius: "50%",
      background: "var(--surface2)", border: "1px solid var(--border)",
      fontSize: 8, fontWeight: 800, color: "var(--muted)", flexShrink: 0,
    }}>
      {name?.slice(0, 1)?.toUpperCase() || "?"}
    </span>
  )
}

export default function FavoriteTeamPicker() {
  const { t } = useTranslation()
  const [fav, setFav]     = useFavoriteTeam()
  const [teams, setTeams] = useState([])
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    fetch("/api/v1/teams?wc=1")
      .then(r => r.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onEscape(e)  { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("keydown", onEscape)
    return () => {
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("keydown", onEscape)
    }
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
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 20, padding: "6px 14px", cursor: "pointer", color: "#fff",
          fontSize: "0.78rem", fontWeight: 600, transition: ".2s",
        }}
      >
        {fav ? (
          <>
            <FlagOrInitial src={fav.flag_url} name={fav.name} />
            <span>{fav.name}</span>
            <span style={{ color: "var(--muted)", marginLeft: 2 }}>★</span>
          </>
        ) : (
          <span>★ {t("home.followTeam", "Seguir un equipo")}</span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("home.followTeam")}
          style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 12, width: 260, boxShadow: "0 8px 32px rgba(0,0,0,.5)",
          }}
        >
          <input
            autoFocus
            placeholder={t("team.searchPlaceholder", "Buscar equipo…")}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={t("team.searchPlaceholder", "Buscar equipo…")}
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
                ✕ {t("team.removeFavorite", "Quitar favorito")}
              </button>
            )}
            {filtered.map(tm => (
              <button
                key={tm.id}
                role="option"
                aria-selected={fav?.id === tm.id}
                onClick={() => pick(tm)}
                style={{
                  width: "100%", textAlign: "left", background: fav?.id === tm.id ? "rgba(238,30,70,.15)" : "transparent",
                  border: "none", color: "#fff", padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                  fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <FlagOrInitial src={tm.flag_url} name={tm.name} />
                <span>{tm.name}</span>
                {tm.group && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--muted)" }}>{t("nav.group", { letter: tm.group })}</span>}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: "0.78rem", textAlign: "center", padding: "12px 0" }}>
                {t("team.noTeamsFound", "Sin equipos encontrados")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
