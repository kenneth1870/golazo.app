import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague, translateCountry } from "../../i18n/leagueNames"
import { translateTeam } from "../../i18n/teamNames"
import MatchRow from "../../components/MatchRow"
import FlagImg from "../../components/FlagImg"
import { useLocale } from "../../hooks/useLocale"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useFavorites } from "../../hooks/useFavorites"
import { fetchWithTimeout } from "../../utils/fetchWithTimeout"
import { prefetchMatchDetail, navIdFor } from "../../utils/matchDetailCache"
import { useStandingsChannel } from "../../hooks/useStandingsChannel"
import { useLiveScoresChannel } from "../../hooks/useLiveScoresChannel"

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

const WC_START = new Date("2026-06-11T00:00:00")

// ─── Date strip ───────────────────────────────────────
function DateStrip({ selected, onChange }) {
  const { i18n }    = useTranslation()
  const locale      = i18n.language || "en"
  const todayISO    = toISO(new Date())
  const selectedISO = toISO(selected)
  const touchStartX = useRef(null)
  const atMinDate   = toISO(selected) <= toISO(WC_START)

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
        style={{ flexShrink: 0, minWidth: 44, minHeight: 44, opacity: atMinDate ? 0.3 : 1 }}
        onClick={() => !atMinDate && onChange(addDays(selected, -1))}
        aria-label="Previous day"
        disabled={atMinDate}
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
                {d.toLocaleDateString(locale, { weekday: "short" })}
              </div>
              <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>
                {d.toLocaleDateString(locale, { month: "short", day: "numeric" })}
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
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded]   = useState(false)
  const [goals,    setGoals]      = useState(null)   // null=not yet fetched
  const [fetching, setFetching]   = useState(false)

  const isLive      = match.status === "live"
  const isFinished  = match.status === "finished"
  const hasScore    = match.home_score !== null && match.away_score !== null
  const clickable   = !!match.external_id
  const expandable  = (isLive || isFinished) && clickable

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "TBD"

  const handleTap = () => {
    if (!expandable) {
      // Upcoming match: navigate directly
      if (clickable) onMatchClick(match.external_id, match)
      return
    }
    if (!expanded) {
      setExpanded(true)
      if (goals === null && !fetching && match.external_id) {
        setFetching(true)
        fetch(`/api/v1/match_detail/${match.external_id}`)
          .then(r => r.json())
          .then(data => setGoals((data.events || []).filter(e => e.type === "Goal" && e.detail !== "Goal Disallowed")))
          .catch(() => setGoals([]))
          .finally(() => setFetching(false))
      }
    } else {
      setExpanded(false)
    }
  }

  return (
    <div>
      <div
        className={`match-row${isLive ? " match-row--live" : ""}${clickable ? " match-row--clickable" : ""}${flashing ? " match-row--score-flash" : ""}`}
        onClick={handleTap}
        onMouseEnter={clickable ? () => prefetchMatchDetail(navIdFor(match)) : undefined}
        onTouchStart={clickable ? () => prefetchMatchDetail(navIdFor(match)) : undefined}
      >
        <div className="match-row__status">
          {isLive
            ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}${match.minute_extra ? `+${match.minute_extra}` : ""}'` : t("status.live")}</span>
            : isFinished
            ? <span className="match-status-ft">{t("status.ft")}</span>
            : <span className="match-status-time">{kickoffTime}</span>
          }
        </div>
        <div className="match-row__teams">
          <div className="match-row__team match-row__team--home">
            <FlagImg src={match.home_team?.flag_url} name={match.home_team?.name} size={16} className="flag-xs" />
            <span className="team-name">
              {translateTeam(match.home_team?.name, i18n.language) || match.home_slot || "TBD"}
            </span>
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
            <span className="team-name">
              {translateTeam(match.away_team?.name, i18n.language) || match.away_slot || "TBD"}
            </span>
            <FlagImg src={match.away_team?.flag_url} name={match.away_team?.name} size={16} className="flag-xs" />
          </div>
        </div>
        <div className="match-row__meta" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {!isLive && !isFinished && clickable && (
            <span
              onClick={e => { e.stopPropagation(); onMatchClick(match.external_id, match) }}
              style={{
                fontSize: "0.6rem", fontWeight: 700, padding: "2px 7px",
                background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.25)",
                borderRadius: 10, color: "#ee1e46", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              🎯
            </span>
          )}
          {expandable && (
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", transition: "transform .2s", display: "inline-block", transform: expanded ? "rotate(90deg)" : "none" }}>›</span>
          )}
          {!expandable && clickable && <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>›</span>}
        </div>
      </div>

      {/* ── Inline goal panel ── */}
      {expanded && (
        <div style={{
          background: "var(--surface2)",
          borderTop: "1px solid var(--border)",
          padding: "10px 16px 12px",
          fontSize: ".73rem",
        }}>
          {fetching || goals === null ? (
            <div style={{ display: "flex", gap: 8 }}>
              {[80, 120, 60].map(w => <div key={w} className="loading-shimmer" style={{ height: 14, width: w, borderRadius: 4 }} />)}
            </div>
          ) : goals.length === 0 ? (
            <span style={{ color: "var(--muted)" }}>{t("scores.noGoals", "No goals recorded")}</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {goals.map((g, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: ".75rem" }}>
                    {g.detail === "Own Goal" ? "🔴" : g.detail === "Penalty" ? "⚽🅿" : "⚽"}
                  </span>
                  <span style={{ fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {g.player}
                  </span>
                  <span style={{ color: "var(--muted)", flexShrink: 0 }}>
                    {g.minute}{g.extra ? `+${g.extra}` : ""}'
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); onMatchClick(match.external_id, match) }}
            style={{
              marginTop: 10, background: "none", border: "none",
              color: "var(--accent)", fontSize: ".7rem", fontWeight: 700,
              cursor: "pointer", padding: 0,
            }}
          >
            {t("scores.viewFullMatch", "Ver partido →")}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Competition block ────────────────────────────────
function CompetitionBlock({ matches, navigate, onMatchClick, flashIds }) {
  const { t, i18n } = useTranslation()
  const comp    = matches[0]?.competition
  const hasLive = matches.some(m => m.status === "live")
  // Use the rich RealMatchRow (with expandable goals) for any match that has an
  // external_id — covers both live-API matches ("ext_" ids) and WC DB matches ("db_" ids).
  const isReal  = !!matches[0]?.external_id
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
        <FlagImg src={comp?.logo} name={comp?.name} size={20} className="logo-sm" />
        <h3 style={{ margin: 0 }}>{translateLeague(comp?.name, i18n.language) ?? "Other"}</h3>
        <span className="widget-meta-country" style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{translateCountry(comp?.country, i18n.language)}</span>
        {hasLive && <span className="live-badge">{t("status.live")}</span>}
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
  const { t, i18n } = useTranslation()
  if (!match) return null
  const isLive = match.status === "live"
  if (!isLive) return null

  const home = translateTeam(match.home_team?.name, i18n.language)
  const away = translateTeam(match.away_team?.name, i18n.language)
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

// ─── Empty state with upcoming WC teaser ──────────────
function EmptyState({ label, t }) {
  return (
    <div className="empty-state">
      <div className="empty-state__pitch" />
      <div className="empty-state__icon" aria-hidden="true">📅</div>
      <h3>{t("time.noMatches", { date: label })}</h3>
      <p>{t("time.tryDifferent")}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────
const PULL_THRESHOLD = 64

export default function TodayPage() {
  const { t } = useTranslation()
  usePageMeta(t("time.today"), "Today's live scores and fixtures for FIFA World Cup 2026 and all football competitions — real-time goals and updates.")
  const [selected, setSelected] = useState(startOfDay)
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDist, setPullDist]     = useState(0)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [flashIds, setFlashIds] = useState(new Set())
  const [filterMyTeams, setFilterMyTeams] = useState(false)
  const prevMatchesRef = useRef([])
  const flashTimerRef  = useRef(null)
  useEffect(() => () => clearTimeout(flashTimerRef.current), [])
  const pullStartY  = useRef(null)
  const isPulling   = useRef(false)
  const navigate     = useNavigate()
  const onMatchClick = (extId, match) => {
    const allClickable = matches.filter(m => m.external_id)
    const idx = allClickable.findIndex(m => m.external_id === extId)
    navigate(`/matches/${extId}`, {
      state: {
        preview: match,
        matchList: allClickable.map(m => ({
          external_id: m.external_id,
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff_at: m.kickoff_at,
          status: m.status,
          home_score: m.home_score,
          away_score: m.away_score,
        })),
        matchIdx: idx,
      }
    })
  }
  const { timezone } = useLocale()
  const { favoriteTeams, favoriteTeamNames } = useFavorites()
  const favTeam = favoriteTeams[0] ?? null

  const load = useCallback((date, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    const iso    = toISO(date)
    const today  = toISO(new Date())
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const url    = iso === today
      ? `/api/v1/today?tz=${encodeURIComponent(tz)}`
      : `/api/v1/today?date=${iso}&tz=${encodeURIComponent(tz)}`
    setError(false)
    fetchWithTimeout(url)
      .then(r => r.json())
      .then(raw => {
        // Filter by local kickoff date — the API uses UTC dates which can bleed
        // into the previous/next day for users in non-UTC timezones.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const filtered = raw.filter(m => {
          if (m.upcoming_preview) return true   // preview matches bypass the date filter
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
          clearTimeout(flashTimerRef.current)
          flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 2000)
        }
        prevMatchesRef.current = filtered
        // Merge: if a live WebSocket update already applied a higher score than the
        // poll snapshot, keep the fresher score — polls can lag behind WS pushes.
        setMatches(cur => {
          const curById = new Map(cur.map(m => [m.external_id ?? m.id, m]))
          return filtered.map(m => {
            const key = m.external_id ?? m.id
            const ws  = curById.get(key)
            if (!ws || m.status !== "live") return m
            const pollTotal = (m.home_score ?? 0) + (m.away_score ?? 0)
            const wsTotal   = (ws.home_score ?? 0) + (ws.away_score ?? 0)
            return wsTotal > pollTotal
              ? { ...m, home_score: ws.home_score, away_score: ws.away_score, minute: ws.minute }
              : m
          })
        })
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

  // Safety-net poll only for today. Live score changes arrive instantly via
  // the live_scores WebSocket; this backstops a dropped connection.
  // 30s when a match is live (matches the server's live-sync cadence so we
  // never lag more than one extra cycle), 5min when nothing is on.
  const hasLive = matches.some(m => m.status === "live")
  useEffect(() => {
    const iso   = toISO(selected)
    const today = toISO(new Date())
    if (iso !== today) return
    // Pause the safety-net poll while the tab is hidden; refresh on return.
    const interval  = hasLive ? 15000 : 300000
    const tick      = () => { if (!document.hidden) load(selected) }
    const onVisible = () => { if (!document.hidden) load(selected) }
    const iv = setInterval(tick, interval)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
      clearTimeout(flashTimerRef.current)
    }
  }, [selected, load, hasLive])

  // Patch a single row in-place from a live_scores push — no re-fetch.
  const applyLiveScore = useCallback((d) => {
    setMatches(prev => {
      let touched = false
      const next = prev.map(m => {
        const hit = (d.external_id != null && m.external_id === d.external_id) ||
                    (d.match_id != null && m.id === d.match_id)
        if (!hit) return m
        if (m.home_score === d.home_score && m.away_score === d.away_score &&
            m.status === d.status && m.minute === d.minute) return m
        touched = true
        return { ...m, home_score: d.home_score, away_score: d.away_score,
                 status: d.status, minute: d.minute, minute_extra: d.minute_extra }
      })
      if (touched) {
        const id = d.external_id ?? d.match_id
        setFlashIds(new Set([id]))
        clearTimeout(flashTimerRef.current)
        flashTimerRef.current = setTimeout(() => setFlashIds(new Set()), 2000)
      }
      return touched ? next : prev
    })
  }, [])
  useLiveScoresChannel(applyLiveScore)

  // Instant refresh when a WC match finishes (standings broadcast fires after FT)
  useStandingsChannel(() => load(selected))

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

  // Separate upcoming WC preview matches (injected when today is empty)
  const upcomingPreview = matches.filter(m => m.upcoming_preview)
  const todayMatches    = matches.filter(m => !m.upcoming_preview)

  const byComp = useMemo(() => todayMatches.reduce((acc, m) => {
    // Prefer competition.code so API (code="WC", id=league_id) and DB (code="WC", id=db_id)
    // always land in the same bucket instead of creating duplicate competition blocks.
    const key = m.competition?.code ?? m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {}), [todayMatches])

  const allGroups = useMemo(() => Object.values(byComp).sort((a, b) => {
    const aLive = a.some(m => m.status === "live") ? 0 : 1
    const bLive = b.some(m => m.status === "live") ? 0 : 1
    return aLive - bLive || (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
  }), [byComp])

  // Exact team name matcher — avoids "Real" matching "Real Salt Lake", "Real Betis", etc.
  function teamMatches(teamName, favName) {
    if (!teamName || !favName) return false
    return teamName.toLowerCase().trim() === favName.toLowerCase().trim()
  }
  function matchInvolvesAnyFav(m) {
    return favoriteTeamNames.some(name =>
      teamMatches(m.home_team?.name, name) || teamMatches(m.away_team?.name, name)
    )
  }

  // "My Teams" filter — only show competition blocks that include a followed team
  const groups = filterMyTeams && favoriteTeamNames.length > 0
    ? allGroups.filter(g => g.some(matchInvolvesAnyFav))
    : allGroups

  const liveCount = todayMatches.filter(m => m.status === "live").length
  const label     = useDateLabel(selected, t)

  const favLiveMatch = !alertDismissed && favTeam ? todayMatches.find(m =>
    m.status === "live" && (
      teamMatches(m.home_team?.name, favTeam.name) ||
      teamMatches(m.away_team?.name, favTeam.name)
    )
  ) : null

  // "Your Matches" = any match involving a followed team today
  const yourMatches = favoriteTeamNames.length > 0
    ? todayMatches.filter(matchInvolvesAnyFav)
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

      <div className="container">
        {/* Date strip */}
        <div className="mb-4">
          <DateStrip selected={selected} onChange={d => { setSelected(d); setMatches([]) }} />
        </div>

        {/* Header row */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{label}</span>
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
            {/* My Teams filter chips — only shown when user follows teams */}
            {favoriteTeamNames.length > 0 && (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => setFilterMyTeams(false)}
                  style={{
                    background: !filterMyTeams ? "var(--accent,#ee1e46)" : "var(--surface2,#1a1a1a)",
                    border: "1px solid " + (!filterMyTeams ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)"),
                    color: !filterMyTeams ? "#fff" : "var(--muted,#888)",
                    borderRadius: 20, padding: "3px 10px", fontSize: "0.68rem",
                    fontWeight: 600, cursor: "pointer", transition: "all .15s",
                  }}
                >
                  {t("scores.filterAll")}
                </button>
                <button
                  onClick={() => setFilterMyTeams(true)}
                  style={{
                    background: filterMyTeams ? "rgba(238,30,70,.15)" : "var(--surface2,#1a1a1a)",
                    border: "1px solid " + (filterMyTeams ? "rgba(238,30,70,.5)" : "var(--border,#2a2a2a)"),
                    color: filterMyTeams ? "#ee1e46" : "var(--muted,#888)",
                    borderRadius: 20, padding: "3px 10px", fontSize: "0.68rem",
                    fontWeight: 600, cursor: "pointer", transition: "all .15s",
                  }}
                >
                  ⭐ {t("scores.myTeams")}
                </button>
              </div>
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
                  <MatchRow key={m.id} match={m} onClick={() => onMatchClick(m.external_id, m)} />
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
            <div className="empty-state__icon" aria-hidden="true">⚠️</div>
            <h3>{t("error.dataUnavailable", "Data unavailable")}</h3>
            <p>{t("error.tryAgain", "Couldn't load matches. Check your connection.")}</p>
            <button className="btn btn-sm btn-outline-light mt-3" onClick={() => load(selected)}>
              {t("error.retry", "Retry")}
            </button>
          </div>
        ) : groups.length === 0 && filterMyTeams ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">⭐</div>
            <h3>{t("scores.myTeams")}</h3>
            <p>{t("scores.yourMatches")} — {t("time.noMatches", { date: label })}</p>
            <button
              onClick={() => setFilterMyTeams(false)}
              style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", marginTop: 12 }}
            >
              {t("scores.filterAll")}
            </button>
          </div>
        ) : groups.length === 0 ? (
          <>
            {/* When WC preview is available, skip the empty state and lead with it */}
            {upcomingPreview.length === 0 && <EmptyState label={label} t={t} />}
            {/* Upcoming WC preview — returned inline by the API when today is empty */}
            {upcomingPreview.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0 4px 10px",
                  fontSize: "0.72rem", fontWeight: 800, color: "#ee1e46",
                  textTransform: "uppercase", letterSpacing: 1,
                }}>
                  <img src="/images/SOCCER.png" alt="" style={{ width: 18, height: 18, objectFit: "contain" }} onError={e => (e.target.style.display = "none")} />
                  FIFA World Cup 2026 — {t("home.upcomingMatches")}
                </div>
                <div className="widget-next-match">
                  <div className="widget-body p-0">
                    {upcomingPreview.map(m => (
                      <MatchRow key={m.id} match={m} onClick={() => onMatchClick(m.external_id, m)} />
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 12, paddingBottom: 8 }}>
                  <button
                    onClick={() => navigate("/scores/fixtures")}
                    style={{
                      background: "none", border: "1px solid var(--border)", borderRadius: 20,
                      color: "var(--muted)", fontSize: "0.75rem", padding: "6px 18px", cursor: "pointer",
                    }}
                  >
                    {t("home.fullSchedule")}
                  </button>
                </div>
              </div>
            )}
          </>
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
