import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../../i18n/leagueNames"
import MatchRow from "../../components/MatchRow"
import { useLocale } from "../../hooks/useLocale"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useFavorites } from "../../hooks/useFavorites"
import { fetchWithTimeout } from "../../utils/fetchWithTimeout"
import PushPrompt from "../../components/PushPrompt"

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

function useDateLabel(date, t) {
  const todayISO     = toISO(new Date())
  const yesterdayISO = toISO(addDays(new Date(), -1))
  const tomorrowISO  = toISO(addDays(new Date(), 1))
  const iso          = toISO(date)
  if (iso === todayISO)     return t("time.today")
  if (iso === yesterdayISO) return t("time.yesterday")
  if (iso === tomorrowISO)  return t("time.tomorrow")
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
}

// ─── Date strip ───────────────────────────────────────
function DateStrip({ selected, onChange }) {
  const todayISO    = toISO(new Date())
  const selectedISO = toISO(selected)
  const touchStartX = useRef(null)

  // 5 days centred on selected — fits comfortably on 375px
  const days = Array.from({ length: 5 }, (_, i) => addDays(selected, i - 2))

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 50) onChange(addDays(selected, dx < 0 ? 1 : -1))
    touchStartX.current = null
  }

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="btn-nav"
        style={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
        onClick={() => onChange(addDays(selected, -1))}
        aria-label="Previous day"
      >←</button>

      <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
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
                padding:      "8px 6px",
                cursor:       "pointer",
                fontSize:     "0.7rem",
                fontWeight:   isSel ? 700 : 400,
                whiteSpace:   "nowrap",
                transition:   "all 0.15s",
                flex:         1,
                minWidth:     44,
                minHeight:    44,
                textAlign:    "center",
              }}
            >
              <div style={{ fontWeight: isSel || isToday ? 700 : 400 }}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </div>
              <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>
                {d.toLocaleDateString([], { month: "short", day: "numeric" })}
              </div>
            </button>
          )
        })}
      </div>

      <button
        className="btn-nav"
        style={{ flexShrink: 0, minWidth: 44, minHeight: 44 }}
        onClick={() => onChange(addDays(selected, 1))}
        aria-label="Next day"
      >→</button>
    </div>
  )
}

// ─── Real-match row (API shape) ────────────────────────
function RealMatchRow({ match, onMatchClick, flashing }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null
  const clickable  = !!match.external_id

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""

  return (
    <div
      className={`match-row${isLive ? " match-row--live" : ""}${clickable ? " match-row--clickable" : ""}${flashing ? " match-row--score-flash" : ""}`}
      onClick={clickable ? () => onMatchClick(match.external_id, match) : undefined}
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
          {match.home_red_cards > 0 && (
            <span className="red-card-badge">🟥{match.home_red_cards > 1 ? `×${match.home_red_cards}` : ""}</span>
          )}
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__team match-row__team--away">
          {match.away_red_cards > 0 && (
            <span className="red-card-badge">🟥{match.away_red_cards > 1 ? `×${match.away_red_cards}` : ""}</span>
          )}
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
function CompetitionBlock({ matches, navigate, onMatchClick, flashIds }) {
  const { i18n } = useTranslation()
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
        <h3 style={{ margin: 0 }}>{translateLeague(comp?.name, i18n.language) ?? "Other"}</h3>
        <span className="widget-meta-country" style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{comp?.country}</span>
        {hasLive && <span className="live-badge">LIVE</span>}
        {canNav && <span style={{ fontSize: "0.75rem", color: "#ee1e46" }}>→</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m =>
          isReal
            ? <RealMatchRow key={m.id} match={m} onMatchClick={onMatchClick} flashing={flashIds?.has(m.external_id ?? m.id)} />
            : <MatchRow key={m.id} match={m} onClick={m.external_id ? () => onMatchClick(m.external_id, m) : undefined} />
        )}
      </div>
    </div>
  )
}

// ─── Fav team live alert ──────────────────────────────
function FavTeamAlert({ match, onMatchClick, onDismiss }) {
  const { t } = useTranslation()
  if (!match) return null
  const isLive = match.status === "live"
  if (!isLive) return null

  const home = match.home_team?.name
  const away = match.away_team?.name
  const score = match.home_score !== null && match.away_score !== null
    ? `${match.home_score}–${match.away_score}` : null
  const minute = match.minute ? `${match.minute}'` : "LIVE"

  return (
    <div style={{
      background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.35)",
      borderRadius: 12, padding: "12px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 12,
      cursor: "pointer", animation: "pageIn .3s ease",
    }}
      onClick={() => match.external_id && onMatchClick(match.external_id, match)}
    >
      <span className="live-dot" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: ".85rem", color: "#ee1e46" }}>
          {t("scores.yourTeamLive")}
        </div>
        <div style={{ fontSize: ".78rem", color: "#e6edf3", marginTop: 2 }}>
          {home} {score ? score : "vs"} {away}
          <span style={{ marginLeft: 8, color: "#ee1e46", fontWeight: 700 }}>{minute}</span>
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        style={{
          background: "none", border: "none", color: "#888",
          fontSize: "1rem", cursor: "pointer", padding: "0 4px", flexShrink: 0,
        }}
      >✕</button>
    </div>
  )
}

// ─── Skeleton block ───────────────────────────────────
function SkeletonBlock({ rows = 3 }) {
  return (
    <div className="widget-next-match mb-4" style={{ overflow: "hidden" }}>
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        <div className="loading-shimmer" style={{ width: 28, height: 28, borderRadius: 4, flexShrink: 0 }} />
        <div className="loading-shimmer" style={{ width: "40%", height: 14, borderRadius: 4 }} />
      </div>
      <div className="widget-body p-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="match-row" style={{ pointerEvents: "none" }}>
            <div className="loading-shimmer" style={{ width: 36, height: 12, borderRadius: 3 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="loading-shimmer" style={{ width: "55%", height: 11, borderRadius: 3 }} />
              <div className="loading-shimmer" style={{ width: "45%", height: 11, borderRadius: 3, alignSelf: "flex-end" }} />
            </div>
            <div className="loading-shimmer" style={{ width: 40, height: 20, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pull-to-refresh indicator ────────────────────────
function PullIndicator({ distance, refreshing }) {
  const size   = Math.min(distance / 64, 1)
  const radius = 10
  const circ   = 2 * Math.PI * radius
  const dash   = circ * size

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center",
      height: refreshing ? 48 : Math.min(distance * 0.6, 48),
      overflow: "hidden", transition: "height 0.3s ease",
    }}>
      <svg width={28} height={28} viewBox="0 0 28 28"
        style={{
          transform: refreshing ? "none" : `rotate(${size * 360}deg)`,
          transition: refreshing ? "none" : "none",
          opacity: Math.max(size, refreshing ? 1 : 0),
        }}
      >
        <circle cx={14} cy={14} r={radius} fill="none" stroke="rgba(238,30,70,.25)" strokeWidth={2.5} />
        {refreshing ? (
          <circle cx={14} cy={14} r={radius} fill="none" stroke="#ee1e46" strokeWidth={2.5}
            strokeDasharray={`${circ * 0.6} ${circ * 0.4}`}
            strokeLinecap="round"
            style={{ transformOrigin: "50% 50%", animation: "spin 0.8s linear infinite" }}
          />
        ) : (
          <circle cx={14} cy={14} r={radius} fill="none" stroke="#ee1e46" strokeWidth={2.5}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────
function EmptyState({ label, t }) {
  return (
    <div className="empty-state">
      <div className="empty-state__pitch" />
      <div className="empty-state__icon">📅</div>
      <h3>{t("time.noMatches", { date: label })}</h3>
      <p>{t("time.tryDifferent")}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────
const PULL_THRESHOLD = 64

export default function TodayPage() {
  const { t } = useTranslation()
  usePageMeta(t("time.today"), "Today's live football scores, results and fixtures — all competitions.")
  const [selected, setSelected] = useState(startOfDay)
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDist, setPullDist]     = useState(0)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [flashIds, setFlashIds] = useState(new Set())
  const prevMatchesRef = useRef([])
  const pullStartY  = useRef(null)
  const isPulling   = useRef(false)
  const navigate     = useNavigate()
  const onMatchClick = (extId, match) => navigate(`/matches/${extId}`, { state: { preview: match } })
  const { timezone } = useLocale()
  const { favoriteTeams, favoriteTeamNames } = useFavorites()
  const favTeam = favoriteTeams[0] ?? null

  const load = useCallback((date, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const iso    = toISO(date)
    const today  = toISO(new Date())
    const url    = iso === today ? "/api/v1/today" : `/api/v1/today?date=${iso}`
    setError(false)
    fetchWithTimeout(url)
      .then(r => r.json())
      .then(raw => {
        // Filter by local kickoff date — the API uses UTC dates which can bleed
        // into the previous/next day for users in non-UTC timezones.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const filtered = raw.filter(m => {
          const ko = m.kickoff_at || m.kickoff
          if (!ko) return false
          const localDate = new Date(ko).toLocaleDateString("en-CA", { timeZone: tz })
          return localDate === iso
        })
        // Detect score changes to flash updated rows
        const prev = prevMatchesRef.current
        const changed = new Set()
        filtered.forEach(m => {
          const old = prev.find(p => p.id === m.id || p.external_id === m.external_id)
          if (old && (old.home_score !== m.home_score || old.away_score !== m.away_score)) {
            changed.add(m.external_id ?? m.id)
          }
        })
        if (changed.size > 0) {
          setFlashIds(changed)
          setTimeout(() => setFlashIds(new Set()), 2000)
        }
        prevMatchesRef.current = filtered
        setMatches(filtered)
      })
      .catch(() => { setError(true); setMatches([]) })
      .finally(() => { setLoading(false); setTimeout(() => setRefreshing(false), 350) })
  }, [])

  useEffect(() => { load(selected); setAlertDismissed(false) }, [selected, load])

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

  // Auto-refresh only for today — 30s when matches are live, 60s otherwise
  useEffect(() => {
    const iso   = toISO(selected)
    const today = toISO(new Date())
    if (iso !== today) return
    const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "LIVE"])
    const hasLive = matches.some(m => LIVE_STATUSES.has(m.status?.short ?? m.status))
    const iv = setInterval(() => load(selected), hasLive ? 30000 : 60000)
    return () => clearInterval(iv)
  }, [selected, load, matches])

  // Pull-to-refresh touch handlers
  function onPTRStart(e) {
    if (window.scrollY > 0) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }
  function onPTRMove(e) {
    if (!isPulling.current || pullStartY.current === null) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy <= 0) { setPullDist(0); return }
    setPullDist(Math.min(dy, PULL_THRESHOLD * 1.5))
  }
  function onPTREnd() {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullDist >= PULL_THRESHOLD && !refreshing && !loading) {
      load(selected, true)
    }
    setPullDist(0)
    pullStartY.current = null
  }

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
  const label     = useDateLabel(selected, t)

  const favLiveMatch = !alertDismissed && favTeam ? matches.find(m =>
    m.status === "live" && (
      m.home_team?.name?.toLowerCase().includes(favTeam.name?.toLowerCase()) ||
      m.away_team?.name?.toLowerCase().includes(favTeam.name?.toLowerCase())
    )
  ) : null

  // "Your Matches" = any match involving a followed team today
  const yourMatches = favoriteTeamNames.length > 0
    ? matches.filter(m =>
        favoriteTeamNames.some(name =>
          m.home_team?.name?.toLowerCase().includes(name.toLowerCase()) ||
          m.away_team?.name?.toLowerCase().includes(name.toLowerCase())
        )
      )
    : []

  return (
    <div
      className="site-section"
      onTouchStart={onPTRStart}
      onTouchMove={onPTRMove}
      onTouchEnd={onPTREnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDist > 4 || refreshing) && (
        <PullIndicator distance={pullDist} refreshing={refreshing} />
      )}

      {/* Push notification prompt — shown 3s after load */}
      <PushPrompt favoriteTeamName={favTeam?.name || null} />

      <div className="container">
        {/* Date strip */}
        <div className="mb-4">
          <DateStrip selected={selected} onChange={d => { setSelected(d); setMatches([]) }} />
        </div>

        {/* Header row */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "#fff" }}>{label}</span>
            {toISO(selected) !== toISO(new Date()) && (
              <button
                onClick={() => { setSelected(startOfDay()); setMatches([]) }}
                style={{
                  background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.3)",
                  borderRadius: 20, padding: "3px 10px", color: "#ee1e46",
                  fontSize: "0.68rem", fontWeight: 700, cursor: "pointer",
                }}
              >
                {t("time.today")}
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.78rem" }}>
            {liveCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#ee1e46" }}>
                <span className="live-dot" />{t("time.liveCount", { count: liveCount })}
              </span>
            )}
            {!loading && (
              <span style={{ color: "#555" }}>{t("time.matchCount", { count: matches.length })}</span>
            )}
          </div>
        </div>

        {/* Favorite team live alert */}
        <FavTeamAlert
          match={favLiveMatch}
          onMatchClick={onMatchClick}
          onDismiss={() => setAlertDismissed(true)}
        />

        {/* Your Matches — pinned section for followed teams */}
        {!loading && yourMatches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
              fontSize: "0.75rem", fontWeight: 700, color: "#ee1e46", textTransform: "uppercase", letterSpacing: 1,
            }}>
              <span>★</span> {t("scores.yourMatches")}
            </div>
            <div className="widget-next-match">
              <div className="widget-body p-0">
                {yourMatches.map(m => (
                  <MatchRow key={m.id} match={m} onClick={() => onMatchClick(m)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <>
            <SkeletonBlock rows={3} />
            <SkeletonBlock rows={2} />
            <SkeletonBlock rows={4} />
          </>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <h3>{t("error.dataUnavailable", "Data unavailable")}</h3>
            <p>{t("error.tryAgain", "Couldn't load matches. Check your connection.")}</p>
            <button className="btn btn-sm btn-outline-light mt-3" onClick={() => load(selected)}>
              {t("error.retry", "Retry")}
            </button>
          </div>
        ) : groups.length === 0 ? (
          <EmptyState label={label} t={t} />
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock
              key={g[0]?.competition?.id ?? i}
              matches={g}
              navigate={navigate}
              onMatchClick={onMatchClick}
              flashIds={flashIds}
            />
          ))
        )}
      </div>
    </div>
  )
}
