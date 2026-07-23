import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { resolveTeamLogo } from "../i18n/teamNames"
import { clubTeamPath } from "../utils/clubTeamPath"
import { fetchJson } from "../utils/fetchJson"

function FlagOrInitials({ name, flagUrl, size = 24 }) {
  const [err, setErr] = useState(false)
  const initials = name?.slice(0, 2).toUpperCase() || "?"
  const logo = resolveTeamLogo(name, flagUrl)
  if (logo && !err) {
    return (
      <img
        src={logo}
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

const INERT_SELECTORS = [".site-wrap > main", ".site-wrap > footer", ".bottom-nav", ".site-navbar", ".site-mobile-menu"]

export default function SearchBar({ onClose, returnFocusRef }) {
  const { t, i18n } = useTranslation()
  const [query, setQuery]     = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(0)
  const navigate  = useNavigate()
  const inputRef     = useRef(null)
  const dialogRef    = useRef(null)
  const timerRef     = useRef(null)
  const abortRef     = useRef(null)

  const close = useCallback(() => { onClose() }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
    const inerted = INERT_SELECTORS.flatMap(s => [...document.querySelectorAll(s)])
    inerted.forEach(el => { el.inert = true })
    return () => {
      inerted.forEach(el => { el.inert = false })
      returnFocusRef?.current?.focus()
    }
  }, [returnFocusRef])

  useEffect(() => {
    function onTab(e) {
      if (e.key !== "Tab") return
      const root = dialogRef.current
      if (!root) return
      const focusable = [...root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter(el => !el.disabled)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onTab)
    return () => document.removeEventListener("keydown", onTab)
  }, [])

  // Debounced search with request cancellation
  useEffect(() => {
    clearTimeout(timerRef.current)
    abortRef.current?.abort()
    if (query.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      abortRef.current = new AbortController()
      fetchJson(`/api/v1/search?q=${encodeURIComponent(query)}`, {
        soft: true,
        signal: abortRef.current.signal,
      })
        .then(({ data, ok, offline }) => {
          setResults(ok && !offline && Array.isArray(data) ? data : [])
          setFocused(0)
        })
        .catch(err => { if (err.name !== "AbortError") setResults([]) })
        .finally(() => setLoading(false))
    }, 280)
    return () => { clearTimeout(timerRef.current); abortRef.current?.abort() }
  }, [query])

  const go = useCallback((result) => {
    if (!result?.id) return
    if (result.type === "team") {
      if (String(result.id).startsWith("club-") && result.league_code) {
        const slug = result.slug || result.name
        navigate(clubTeamPath(result.league_code, slug))
      } else if (!String(result.id).startsWith("club-")) {
        navigate(`/teams/${result.id}`)
      } else {
        navigate("/leagues")
      }
    } else if (result.type === "match") {
      if (result.external_id) {
        navigate(`/matches/${result.external_id}`)
      } else {
        navigate(`/matches/db-${result.id}`)
      }
    } else if (result.type === "player") {
      navigate(`/players/${result.id}`)
    }
    close()
  }, [navigate, close])

  function resultLabel(r) {
    if (r.type === "team") return t("a11y.searchResultTeam", { name: r.name })
    if (r.type === "player") return t("a11y.searchResultPlayer", { name: r.name })
    return t("a11y.matchRow", { home: r.home, away: r.away })
  }

  function handleResultKeyDown(e, result) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      e.stopPropagation()
      go(result)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { close(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setFocused(f => Math.min(f + 1, results.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === "Enter" && results[focused]) { go(results[focused]) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [results, focused, go, close])

  const statusLabel = (r) => {
    if (r.status === "live")     return <span style={{ color: "var(--accent)", fontSize: "0.68rem", fontWeight: 800 }}>● {t("status.live")}</span>
    if (r.status === "finished") return <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{t("status.ft")}</span>
    if (r.kickoff_at) {
      const d = new Date(r.kickoff_at)
      const locale = i18n.language || undefined
      const label = d.toLocaleDateString(locale, { month: "short", day: "numeric" }) + " " +
        d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
      return <span style={{ color: "#10b981", fontSize: "0.68rem", fontWeight: 600 }}>{label}</span>
    }
    return <span style={{ color: "var(--muted)", fontSize: "0.68rem" }}>{t("time.tbd")}</span>
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          zIndex: 3000, backdropFilter: "blur(4px)", animation: "fadeIn .15s",
        }}
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("search.title", "Search")}
        className="search-bar"
      >
        {/* Input */}
        <div className="search-bar__header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" className="search-bar__icon">
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
            className="search-bar__input"
          />
          {loading && <span className="search-bar__loading">…</span>}
          <button
            type="button"
            onClick={close}
            aria-label={t("a11y.close")}
            className="search-bar__close focus-brand"
          >✕</button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="search-bar__results">
            {results.map((r, i) => (
              <div
                key={`${r.type}-${r.id}`}
                role="button"
                tabIndex={0}
                aria-label={resultLabel(r)}
                className="focus-brand"
                onClick={() => go(r)}
                onKeyDown={e => handleResultKeyDown(e, r)}
                onFocus={() => setFocused(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", cursor: "pointer",
                  background: i === focused ? "var(--surface2)" : "transparent",
                  borderBottom: "1px solid var(--border)",
                  transition: "background .1s",
                }}
                onMouseEnter={() => setFocused(i)}
              >
                {r.type === "team" ? (
                  <>
                    <FlagOrInitials name={r.code || r.name} flagUrl={r.flag_url} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" }}>{r.name}</div>
                      {r.group
                        ? <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{t("nav.group", { letter: r.group })}</div>
                        : r.league_code
                          ? <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{r.league_code}</div>
                          : null}
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--muted)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4 }}>{t("table.team")}</span>
                  </>
                ) : r.type === "player" ? (
                  <>
                    {r.photo ? (
                      <img src={r.photo} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <FlagOrInitials name={r.name} flagUrl={null} size={32} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" }}>{r.name}</div>
                      {r.team && <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{r.team}</div>}
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "var(--muted)", background: "var(--surface2)", padding: "2px 7px", borderRadius: 4 }}>{t("table.player")}</span>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                      <FlagOrInitials name={r.home} flagUrl={r.home_flag} size={24} />
                      <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.88rem" }}>{r.home}</span>
                      {r.home_score !== null && r.away_score !== null ? (
                        <span style={{ fontWeight: 900, color: "var(--text)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 4, fontSize: "0.85rem" }}>
                          {r.home_score}–{r.away_score}
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>vs</span>
                      )}
                      <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.88rem" }}>{r.away}</span>
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
