import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"
import { useAppFocus } from "../hooks/useAppFocus"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { resolveTeamLogo, translateTeam } from "../i18n/teamNames"
import { loadClubTeams } from "../utils/loadClubTeams"
import { syncTeamFollowToPush } from "../utils/favoritePush"

function FlagOrInitial({ src, name }) {
  const [err, setErr] = useState(false)
  const logo = resolveTeamLogo(name, src)
  if (logo && !err) {
    return <img src={logo} alt="" className="flag-xs" onError={() => setErr(true)} />
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
  const { t, i18n } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const [fav, setFav]     = useFavoriteTeam()
  const { addTeams, subscribed } = usePushNotifications()
  const [teams, setTeams] = useState([])
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    if (clubsPrimary) {
      loadClubTeams(setTeams)
      return
    }

    fetch("/api/v1/teams?wc=1")
      .then(r => r.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [clubsPrimary])

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

  const displayName = name => translateTeam(name, i18n.language) || name

  const filtered = teams.filter(tm => {
    const label = displayName(tm.name)?.toLowerCase() || ""
    const q = query.toLowerCase()
    return label.includes(q) || tm.name?.toLowerCase().includes(q)
  })

  function pick(team) {
    setFav({ id: team.id, name: team.name, flag_url: team.flag_url, group: team.group, league_code: team.league_code })
    syncTeamFollowToPush(team.name, { addTeams, subscribed, following: true })
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="favorite-team-picker" style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="favorite-team-picker__trigger"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: fav ? "rgba(238,30,70,.12)" : "var(--surface2)",
          border: fav ? "1px solid rgba(238,30,70,.35)" : "1px solid var(--border)",
          borderRadius: 20, padding: "8px 14px", cursor: "pointer", color: "var(--text)",
          fontSize: "0.78rem", fontWeight: 600, transition: ".2s",
          maxWidth: "100%", minHeight: 44,
        }}
      >
        {fav ? (
          <>
            <FlagOrInitial src={fav.flag_url} name={fav.name} />
            <span className="favorite-team-picker__label">{displayName(fav.name)}</span>
            <span style={{ color: "var(--muted)", marginLeft: 2, flexShrink: 0 }}>★</span>
          </>
        ) : (
          <span>★ {t("home.followTeam", "Seguir un equipo")}</span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("home.followTeam")}
          className="favorite-team-picker__menu"
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
              borderRadius: 6, padding: "10px", color: "var(--text)", fontSize: "0.8rem", marginBottom: 8,
              minHeight: 44,
            }}
          />
          <div style={{ maxHeight: "min(240px, 50vh)", overflowY: "auto" }}>
            {fav && (
              <button
                onClick={() => { setFav(null); setOpen(false) }}
                style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: "var(--danger)", padding: "10px 8px", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", marginBottom: 4, minHeight: 44 }}
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
                  border: "none", color: "var(--text)", padding: "10px 8px", borderRadius: 6, cursor: "pointer",
                  fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 8, minHeight: 44,
                }}
              >
                <FlagOrInitial src={tm.flag_url} name={tm.name} />
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(tm.name)}</span>
                {tm.group && <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "var(--muted)", flexShrink: 0 }}>{t("nav.group", { letter: tm.group })}</span>}
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
