import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

function FlagOrInitials({ name, flagUrl, size = 24 }) {
  const [err, setErr] = useState(false)
  const initials = name?.slice(0, 2).toUpperCase() || "?"

  if (flagUrl && !err) {
    return (
      <img
        src={flagUrl}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: 2, flexShrink: 0 }}
      />
    )
  }

  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--surface2)", border: "1px solid var(--border)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "var(--muted)", flexShrink: 0,
    }}>{initials}</span>
  )
}

export default function SearchBar({ onClose }) {
  const { t } = useTranslation()
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(0)
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const timerRef  = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); return }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => { setResults(data); setFocused(0) })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 280)
    return () => clearTimeout(timerRef.current)
  }, [query])

  const go = useCallback((result) => {
    if (result.type === "team") {
      navigate(`/teams/${result.id}`)
    } else if (result.type === "match") {
      const dest = `/matches/db-${result.id}`
      navigate(dest)
    }
    onClose()
  }, [navigate, onClose])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onClose(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === "Enter" && results[focused]) { go(results[focused]) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [results, focused, go, onClose])

  const statusLabel = (r) => {
    if (r.status === "live")     return <span style={{ color: "#ee1e46", fontSize: "0.68rem", fontWeight: 800 }}>● LIVE</span>
    if (r.status === "finished") return <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>FT</span>
    if (r.kickoff_at) {
      const d = new Date(r.kickoff_at)
      const label = d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      return <span style={{ color: "#10b981", fontSize: "0.68rem", fontWeight: 600 }}>{label}</span>
    }
    return <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>TBD</span>
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 3000, backdropFilter: "blur(4px)", animation: "fadeIn .15s",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)",
        width: "min(560px, 92vw)", zIndex: 3001,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        animation: "pageIn .15s ease",
      }}>
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#fff", fontSize: "1rem", fontFamily: "inherit",
            }}
          />
          {loading && <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>…</span>}
          <button onClick={onClose} style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px", fontSize: "0.72rem", color: "var(--muted)",
            cursor: "pointer", fontFamily: "inherit", fontWeight: 600, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {results.map((r, i) => (
              <div
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  background: i === focused ? "var(--surface2)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  transition: "background .1s",
                }}
                onMouseEnter={() => setFocused(i)}
              >
                {r.type === "team" ? (
                  <>
                    <FlagOrInitials name={r.code || r.name} flagUrl={r.flag_url} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>{r.name}</div>
                      {r.group && <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{t("nav.group", { letter: r.group })}</div>}
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--muted)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4 }}>{t("table.team")}</span>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                      <FlagOrInitials name={r.home} flagUrl={r.home_flag} size={24} />
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.88rem" }}>{r.home}</span>
                      {r.home_score !== null && r.away_score !== null ? (
                        <span style={{ fontWeight: 900, color: "#fff", background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, fontSize: "0.85rem" }}>
                          {r.home_score}–{r.away_score}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>vs</span>
                      )}
                      <span style={{ fontWeight: 700, color: "#fff", fontSize: "0.88rem" }}>{r.away}</span>
                      <FlagOrInitials name={r.away} flagUrl={r.away_flag} size={24} />
                    </div>
                    {statusLabel(r)}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : query.length >= 2 && !loading ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
            {t("search.noResults", { query })}
          </div>
        ) : (
          <div style={{ padding: "20px 16px", fontSize: "0.78rem", color: "var(--muted)" }}>
            {t("search.hint")}
          </div>
        )}

        <div className="search-bar__footer">
          <span>{t("search.navigate")}</span><span>{t("search.select")}</span><span>{t("search.close")}</span>
        </div>
      </div>
    </>
  )
}
