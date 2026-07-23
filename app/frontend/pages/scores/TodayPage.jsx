import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague, translateCountry } from "../../i18n/leagueNames"
import { translateTeam } from "../../i18n/teamNames"
import MatchRow from "../../components/MatchRow"
import FlagImg from "../../components/FlagImg"
import { useLocale } from "../../hooks/useLocale"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useFavorites } from "../../hooks/useFavorites"
import { fetchJson } from "../../utils/fetchJson"
import OfflineBanner from "../../components/OfflineBanner"
import { navIdFor } from "../../utils/matchDetailCache"
import { useStandingsChannel } from "../../hooks/useStandingsChannel"
import { useAppFocus } from "../../hooks/useAppFocus"
import { useLiveScoresChannel } from "../../hooks/useLiveScoresChannel"
import PullIndicator from "../../components/PullIndicator"
import { usePullRefresh } from "../../hooks/usePullRefresh"

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

function useDateLabel(date, t, locale) {
  const todayISO     = toISO(new Date())
  const yesterdayISO = toISO(addDays(new Date(), -1))
  const tomorrowISO  = toISO(addDays(new Date(), 1))
  const iso          = toISO(date)
  if (iso === todayISO)     return t("time.today")
  if (iso === yesterdayISO) return t("time.yesterday")
  if (iso === tomorrowISO)  return t("time.tomorrow")
  return date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
}

const WC_START = new Date("2026-06-11T00:00:00")

// ─── Date strip ───────────────────────────────────────
function DateStrip({ selected, onChange, minDate }) {
  const { t, i18n } = useTranslation()
  const locale      = i18n.language || "en"
  const todayISO    = toISO(new Date())
  const selectedISO = toISO(selected)
  const touchStartX = useRef(null)
  const atMinDate   = minDate ? toISO(selected) <= toISO(minDate) : false

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
      className="date-strip"
      role="group"
      aria-label={t("a11y.selectDate")}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="btn-nav"
        onClick={() => !atMinDate && onChange(addDays(selected, -1))}
        aria-label={t("a11y.previousDay")}
        disabled={atMinDate}
      >←</button>

      <div className="date-strip__days">
        {days.map(d => {
          const iso     = toISO(d)
          const isToday = iso === todayISO
          const isSel   = iso === selectedISO
          const dayClass = [
            "date-strip__day",
            isSel ? "date-strip__day--selected" : "",
            !isSel && isToday ? "date-strip__day--today" : "",
          ].filter(Boolean).join(" ")
          return (
            <button
              key={iso}
              type="button"
              className={dayClass}
              onClick={() => onChange(d)}
              aria-pressed={isSel}
              aria-current={isToday ? "date" : undefined}
            >
              <div className={isSel || isToday ? "date-strip__day-label--emph" : "date-strip__day-label"}>
                {d.toLocaleDateString(locale, { weekday: "short" })}
              </div>
              <div className="date-strip__day-sub">
                {d.toLocaleDateString(locale, { month: "short", day: "numeric" })}
              </div>
            </button>
          )
        })}
      </div>

      <button
        className="btn-nav"
        onClick={() => onChange(addDays(selected, 1))}
        aria-label={t("a11y.nextDay")}
      >→</button>
    </div>
  )
}

// ─── Competition block ────────────────────────────────
function CompetitionBlock({ matches, navigate, onMatchClick, flashIds }) {
  const { t, i18n } = useTranslation()
  const comp    = matches[0]?.competition
  const hasLive = matches.some(m => m.status === "live")
  const canNav  = comp?.code && !String(comp.code).match(/^\d+$/)

  const sorted = [...matches].sort((a, b) => {
    const order = { live: 0, scheduled: 1, finished: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(a.kickoff_at) - new Date(b.kickoff_at)
  })

  const leagueName = translateLeague(comp?.name, i18n.language) ?? "Other"

  function handleHeaderKeyDown(e) {
    if (!canNav) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      navigate(`/leagues/${comp.code}`)
    }
  }

  return (
    <div className="widget-next-match mb-4">
      <div
        className={`widget-title competition-block__header d-flex align-items-center${canNav ? " cursor-pointer" : ""}`}
        style={{ cursor: canNav ? "pointer" : "default" }}
        role={canNav ? "button" : undefined}
        tabIndex={canNav ? 0 : undefined}
        aria-label={canNav ? t("a11y.viewLeague", { name: leagueName }) : undefined}
        onClick={canNav ? () => navigate(`/leagues/${comp.code}`) : undefined}
        onKeyDown={handleHeaderKeyDown}
      >
        <FlagImg src={comp?.logo} name={comp?.name} size={20} className="logo-sm" />
        <h3 className="competition-block__title">{leagueName}</h3>
        <span className="widget-meta-country competition-block__country" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{translateCountry(comp?.country, i18n.language)}</span>
        {hasLive && <span className="live-badge">{t("status.live")}</span>}
        {canNav && <span className="competition-block__nav">→</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m => {
          const navigable = !!navIdFor(m)
          return (
            <MatchRow
              key={m.id}
              match={m}
              flashing={flashIds?.has(m.external_id ?? m.id)}
              showChevron={navigable}
              showMeta={navigable}
              onClick={navigable ? () => onMatchClick(m) : undefined}
            />
          )
        })}
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
  const minute = match.minute ? `${match.minute}'` : t("status.live")
  const clickable = !!navIdFor(match)

  function handleKeyDown(e) {
    if (!clickable) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onMatchClick(match)
    }
  }

  return (
    <div style={{
      background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.35)",
      borderRadius: 12, padding: "12px 16px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 12,
      cursor: clickable ? "pointer" : "default", animation: "pageIn .3s ease",
    }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t("a11y.matchRow", { home, away }) : undefined}
      onClick={() => clickable && onMatchClick(match)}
      onKeyDown={handleKeyDown}
    >
      <span className="live-dot" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: ".85rem", color: "var(--accent)" }}>
          {t("scores.yourTeamLive")}
        </div>
        <div style={{ fontSize: ".78rem", color: "#e6edf3", marginTop: 2 }}>
          {home} {score ? score : "vs"} {away}
          <span style={{ marginLeft: 8, color: "var(--accent)", fontWeight: 700 }}>{minute}</span>
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDismiss() }}
        aria-label={t("a11y.dismiss")}
        style={{
          background: "none", border: "none", color: "var(--muted)",
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

// ─── Empty state with date label ──────────────────────
function TodayEmptyState({ label, t }) {
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
export default function TodayPage() {
  const { t, i18n } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  usePageMeta(
    t("time.today"),
    clubsPrimary
      ? t("home.metaDescTodayClubs")
      : t("home.metaDescTodayWC")
  )
  const [selected, setSelected] = useState(startOfDay)
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [stale, setStale]       = useState(false)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [flashIds, setFlashIds] = useState(new Set())
  const [filterMyTeams, setFilterMyTeams] = useState(false)
  const prevMatchesRef = useRef([])
  const flashTimerRef  = useRef(null)
  useEffect(() => () => clearTimeout(flashTimerRef.current), [])
  const navigate     = useNavigate()
  const onMatchClick = (match) => {
    const navId = navIdFor(match)
    if (!navId) return
    const allClickable = matches.filter(m => navIdFor(m))
    const idx = allClickable.findIndex(m => navIdFor(m) === navId)
    navigate(`/matches/${navId}`, {
      state: {
        preview: match,
        matchList: allClickable.map(m => ({
          external_id: m.external_id,
          id: m.id,
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
    if (!isRefresh) setLoading(true)
    const iso    = toISO(date)
    const today  = toISO(new Date())
    const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    const url    = iso === today
      ? `/api/v1/today?tz=${encodeURIComponent(tz)}`
      : `/api/v1/today?date=${iso}&tz=${encodeURIComponent(tz)}`
    setError(false)
    setStale(false)
    fetchJson(url)
      .then(({ data: raw, stale: isStale, offline, ok }) => {
        if (!ok || offline || !Array.isArray(raw)) {
          setError(true)
          setStale(isStale)
          return
        }
        setStale(isStale)
        // Filter by local kickoff date — the API uses UTC dates which can bleed
        // into the previous/next day for users in non-UTC timezones.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const filtered = raw.filter(m => {
          if (m.upcoming_preview) {
            const ko = m.kickoff_at || m.kickoff
            if (!ko) return false
            const localDate = new Date(ko).toLocaleDateString("en-CA", { timeZone: tz })
            return localDate > iso
          }
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
      .finally(() => { setLoading(false) })
  }, [])

  const ptr = usePullRefresh(() => load(selected, true), { disabled: loading })

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

  function matchInvolvesAnyFav(m) {
    return favoriteTeamNames.some(name =>
      matchTeamName(m.home_team?.name, name, i18n.language) || matchTeamName(m.away_team?.name, name, i18n.language)
    )
  }

  // "My Teams" filter — only show competition blocks that include a followed team
  const groups = filterMyTeams && favoriteTeamNames.length > 0
    ? allGroups.filter(g => g.some(matchInvolvesAnyFav))
    : allGroups

  const liveCount = todayMatches.filter(m => m.status === "live").length
  const label     = useDateLabel(selected, t, i18n.language)
  const isToday   = toISO(selected) === toISO(new Date())
  const previewDayLabel = upcomingPreview[0]?.kickoff_at
    ? new Date(upcomingPreview[0].kickoff_at).toLocaleDateString(i18n.language || undefined, {
        weekday: "long", month: "short", day: "numeric",
      })
    : null

  const favLiveMatch = !alertDismissed && favTeam ? todayMatches.find(m =>
    m.status === "live" && (
      matchTeamName(m.home_team?.name, favTeam.name, i18n.language) ||
      matchTeamName(m.away_team?.name, favTeam.name, i18n.language)
    )
  ) : null

  // "Your Matches" = any match involving a followed team today
  const yourMatches = favoriteTeamNames.length > 0
    ? todayMatches.filter(matchInvolvesAnyFav)
    : []

  const minDate = clubsPrimary ? addDays(new Date(), -30) : WC_START

  return (
    <div
      className="site-section"
      onTouchStart={ptr.onTouchStart}
      onTouchMove={ptr.onTouchMove}
      onTouchEnd={ptr.onTouchEnd}
    >
      {ptr.showIndicator && <PullIndicator distance={ptr.pullDist} refreshing={ptr.refreshing} />}

      {/* Push notification prompt — shown 3s after load */}

      <div className="container">
        {/* Date strip */}
        <div className="mb-4">
          <DateStrip selected={selected} onChange={d => { setSelected(d); setMatches([]) }} minDate={minDate} />
        </div>

        {/* Header row */}
        <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>{label}</span>
            {toISO(selected) !== toISO(new Date()) && (
              <button
                type="button"
                className="filter-tab focus-brand"
                onClick={() => { setSelected(startOfDay()); setMatches([]) }}
                style={{
                  background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.3)",
                  color: "var(--accent)", fontSize: "0.68rem",
                }}
              >
                {t("time.today")}
              </button>
            )}
            {favoriteTeamNames.length > 0 && (
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className={`filter-tab focus-brand${!filterMyTeams ? " active" : ""}`}
                  onClick={() => setFilterMyTeams(false)}
                  style={{ fontSize: "0.68rem", fontWeight: 600 }}
                >
                  {t("scores.filterAll")}
                </button>
                <button
                  type="button"
                  className="filter-tab focus-brand"
                  onClick={() => setFilterMyTeams(true)}
                  style={{
                    fontSize: "0.68rem", fontWeight: 600,
                    background: filterMyTeams ? "rgba(238,30,70,.15)" : undefined,
                    borderColor: filterMyTeams ? "rgba(238,30,70,.5)" : undefined,
                    color: filterMyTeams ? "var(--accent)" : undefined,
                  }}
                >
                  ⭐ {t("scores.myTeams")}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.78rem" }}>
            {liveCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--accent)" }}>
                <span className="live-dot" />{t("time.liveCount", { count: liveCount })}
              </span>
            )}
            {!loading && (
              <span style={{ color: "var(--muted)" }}>{t("time.matchCount", { count: todayMatches.length })}</span>
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
              fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1,
            }}>
              <span>★</span> {t("scores.yourMatches")}
            </div>
            <div className="widget-next-match">
              <div className="widget-body p-0">
                {yourMatches.map(m => {
                  const navigable = !!navIdFor(m)
                  return (
                    <MatchRow
                      key={m.id}
                      match={m}
                      flashing={flashIds?.has(m.external_id ?? m.id)}
                      showChevron={navigable}
                      showMeta={navigable}
                      onClick={navigable ? () => onMatchClick(m) : undefined}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <OfflineBanner stale={stale} onRetry={() => load(selected, true)} />

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
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
              <button
                onClick={() => setFilterMyTeams(false)}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}
              >
                {t("scores.filterAll")}
              </button>
              {clubsPrimary && (
                <Link
                  to="/leagues"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 18px", fontWeight: 700, fontSize: "0.8rem", textDecoration: "none" }}
                >
                  {t("nav.allLeagues")}
                </Link>
              )}
            </div>
          </div>
        ) : groups.length === 0 ? (
          <>
            {todayMatches.length === 0 && <TodayEmptyState label={label} t={t} />}
            {upcomingPreview.length > 0 && isToday && (
              <div style={{ marginTop: todayMatches.length === 0 ? 4 : 0 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "0 4px 10px",
                  fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)",
                  textTransform: "uppercase", letterSpacing: 1,
                }}>
                  <img src="/images/SOCCER.png" alt="" style={{ width: 18, height: 18, objectFit: "contain" }} onError={e => (e.target.style.display = "none")} />
                  {clubsPrimary
                    ? `${t("home.upcomingMatches")}${previewDayLabel ? ` — ${previewDayLabel}` : ""}`
                    : `${t("scores.wcSubtitle")} — ${t("home.upcomingMatches")}`}
                </div>
                <div className="widget-next-match">
                  <div className="widget-body p-0">
                    {upcomingPreview.map(m => (
                      <MatchRow key={m.id} match={m} showDate onClick={() => onMatchClick(m)} />
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "center", marginTop: 12, paddingBottom: 8 }}>
                  <button
                    type="button"
                    className="focus-brand"
                    onClick={() => setSelected(addDays(new Date(), 1))}
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
