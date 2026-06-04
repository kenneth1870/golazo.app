import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import MatchRow from "../../components/MatchRow"
import { useLocale } from "../../hooks/useLocale"

// ─── Helpers ──────────────────────────────────────────
function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dateLabel(date) {
  const todayISO     = toISO(new Date())
  const yesterdayISO = toISO(addDays(new Date(), -1))
  const tomorrowISO  = toISO(addDays(new Date(), 1))
  const iso          = toISO(date)
  if (iso === todayISO)     return "Today"
  if (iso === yesterdayISO) return "Yesterday"
  if (iso === tomorrowISO)  return "Tomorrow"
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

// ─── Date strip ───────────────────────────────────────
function DateStrip({ selected, onChange }) {
  const todayISO    = toISO(new Date())
  const selectedISO = toISO(selected)

  // Show 7 days centred on selected (capped so we don't go too far into future)
  const days = Array.from({ length: 7 }, (_, i) => addDays(selected, i - 3))

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      overflowX: "auto",
      paddingBottom: 2,
    }}>
      <button
        className="btn-nav"
        style={{ flexShrink: 0 }}
        onClick={() => onChange(addDays(selected, -1))}
      >←</button>

      <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center", flexWrap: "nowrap" }}>
        {days.map(d => {
          const iso     = toISO(d)
          const isToday = iso === todayISO
          const isSel   = iso === selectedISO
          return (
            <button
              key={iso}
              onClick={() => onChange(d)}
              style={{
                background:   isSel ? "var(--accent, #ee1e46)" : isToday ? "rgba(238,30,70,0.15)" : "var(--surface2, #1a1a1a)",
                color:        isSel ? "#fff" : isToday ? "var(--accent, #ee1e46)" : "var(--muted, #888)",
                border:       isSel ? "1px solid var(--accent, #ee1e46)" : "1px solid var(--border, #2a2a2a)",
                borderRadius: 8,
                padding:      "6px 10px",
                cursor:       "pointer",
                fontSize:     "0.72rem",
                fontWeight:   isSel ? 700 : 400,
                whiteSpace:   "nowrap",
                transition:   "all 0.15s",
                minWidth:     52,
                textAlign:    "center",
              }}
            >
              <div style={{ fontWeight: isSel || isToday ? 700 : 400 }}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </div>
              <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>
                {d.toLocaleDateString([], { month: "short", day: "numeric" })}
              </div>
            </button>
          )
        })}
      </div>

      <button
        className="btn-nav"
        style={{ flexShrink: 0 }}
        onClick={() => onChange(addDays(selected, 1))}
      >→</button>
    </div>
  )
}

// ─── Real-match row (API shape) ────────────────────────
function RealMatchRow({ match, onMatchClick }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null
  const clickable  = !!match.external_id

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""

  return (
    <div
      className={`match-row${isLive ? " match-row--live" : ""}${clickable ? " match-row--clickable" : ""}`}
      onClick={clickable ? () => onMatchClick(match.external_id) : undefined}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">{kickoffTime}</span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="flag-xs"
              onError={e => (e.target.style.display = "none")} />
          )}
          <span className="team-name">{match.home_team?.name}</span>
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__team match-row__team--away">
          <span className="team-name">{match.away_team?.name}</span>
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="flag-xs"
              onError={e => (e.target.style.display = "none")} />
          )}
        </div>
      </div>
      <div className="match-row__meta">
        {clickable && <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>›</span>}
      </div>
    </div>
  )
}

// ─── Competition block ────────────────────────────────
function CompetitionBlock({ matches, navigate, onMatchClick }) {
  const comp    = matches[0]?.competition
  const hasLive = matches.some(m => m.status === "live")
  const isReal  = typeof matches[0]?.id === "string" && matches[0]?.id?.startsWith("ext_")
  const canNav  = comp?.code && !String(comp.code).match(/^\d+$/)

  const sorted = [...matches].sort((a, b) => {
    const order = { live: 0, scheduled: 1, finished: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(a.kickoff_at) - new Date(b.kickoff_at)
  })

  return (
    <div className="widget-next-match mb-4">
      <div
        className={`widget-title d-flex align-items-center${canNav ? " cursor-pointer" : ""}`}
        style={{ gap: 10, cursor: canNav ? "pointer" : "default" }}
        onClick={canNav ? () => navigate(`/leagues/${comp.code}`) : undefined}
      >
        {comp?.logo && (
          <img src={comp.logo} alt="" className="logo-sm"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{comp?.name ?? "Other"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{comp?.country}</span>
        {hasLive && <span className="live-badge">LIVE</span>}
        {canNav && <span style={{ fontSize: "0.75rem", color: "#ee1e46" }}>→</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m =>
          isReal
            ? <RealMatchRow key={m.id} match={m} onMatchClick={onMatchClick} />
            : <MatchRow key={m.id} match={m} onClick={m.external_id ? () => onMatchClick(m.external_id) : undefined} />
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────
function EmptyState({ label }) {
  return (
    <div className="empty-state">
      <div className="empty-state__pitch" />
      <div className="empty-state__icon">📅</div>
      <h3>No matches for {label}</h3>
      <p>Try a different date</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────
export default function TodayPage() {
  const [selected, setSelected] = useState(startOfDay)
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const navigate     = useNavigate()
  const onMatchClick = extId => navigate(`/matches/${extId}`)
  const { timezone } = useLocale()

  const load = useCallback((date) => {
    setLoading(true)
    const iso    = toISO(date)
    const today  = toISO(new Date())
    const url    = iso === today ? "/api/v1/today" : `/api/v1/today?date=${iso}`
    fetch(url)
      .then(r => r.json())
      .then(raw => {
        // Filter by local kickoff date — the API uses UTC dates which can bleed
        // into the previous/next day for users in non-UTC timezones.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const filtered = raw.filter(m => {
          const ko = m.kickoff_at || m.kickoff
          if (!ko) return true
          const localDate = new Date(ko).toLocaleDateString("en-CA", { timeZone: tz })
          return localDate === iso
        })
        setMatches(filtered)
      })
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(selected) }, [selected, load])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return
      if (e.key === "ArrowLeft")  setSelected(d => addDays(d, -1))
      if (e.key === "ArrowRight") setSelected(d => addDays(d,  1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Auto-refresh only for today
  useEffect(() => {
    const iso   = toISO(selected)
    const today = toISO(new Date())
    if (iso !== today) return
    const iv = setInterval(() => load(selected), 60000)
    return () => clearInterval(iv)
  }, [selected, load])

  const byComp = matches.reduce((acc, m) => {
    const key = m.competition?.id ?? m.competition?.code ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const groups = Object.values(byComp).sort((a, b) => {
    const aLive = a.some(m => m.status === "live") ? 0 : 1
    const bLive = b.some(m => m.status === "live") ? 0 : 1
    return aLive - bLive || (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
  })

  const liveCount = matches.filter(m => m.status === "live").length
  const label     = dateLabel(selected)

  return (
    <div className="site-section">
      <div className="container">
        {/* Date strip */}
        <div className="mb-4">
          <DateStrip selected={selected} onChange={d => { setSelected(d); setMatches([]) }} />
        </div>

        {/* Header row */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#fff" }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.78rem" }}>
            {liveCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#ee1e46" }}>
                <span className="live-dot" />{liveCount} live
              </span>
            )}
            {!loading && (
              <span style={{ color: "#555" }}>{matches.length} matches</span>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : groups.length === 0 ? (
          <EmptyState label={label} />
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock
              key={g[0]?.competition?.id ?? i}
              matches={g}
              navigate={navigate}
              onMatchClick={onMatchClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
