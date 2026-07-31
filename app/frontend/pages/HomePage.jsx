import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches, patchLiveScore, mergeLiveMatchSnapshot } from "../hooks/useMatches"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"
import { useFavorites } from "../hooks/useFavorites"
import { useLiveCount } from "../contexts/LiveContext"
import { useAppFocus } from "../hooks/useAppFocus"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { formatKickoff } from "../hooks/useLocalTime"
import { translateTeam } from "../i18n/teamNames"
import { translateLeague, competitionRegion } from "../i18n/leagueNames"
import FlagImg from "../components/FlagImg"
import { clubTeamPath, clubTeamSlug } from "../utils/clubTeamPath"
import { matchKey, matchTeamName } from "../utils/matchTeamName"
import { navIdFor, navigateToMatch } from "../utils/matchDetailCache"
import { sortCompetitionGroups } from "../utils/leagueOrder"
import Hero from "../components/Hero"
import MatchRow from "../components/MatchRow"
import FavoriteTeamPicker from "../components/FavoriteTeamPicker"
import ClubCompetitionChips from "../components/ClubCompetitionChips"
import EmptyState from "../components/EmptyState"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"
import PullIndicator from "../components/PullIndicator"
import { usePullRefresh } from "../hooks/usePullRefresh"
import { useStandingsChannel } from "../hooks/useStandingsChannel"
import { useLiveScoresChannel } from "../hooks/useLiveScoresChannel"
import { useVisiblePolling } from "../hooks/useVisiblePolling"
import { attachNewsPrefetch } from "../utils/newsPrefetch"

function useTodayFeed(wcOnly = false) {
  const [todayMatches, setTodayMatches] = useState([])
  const [upcomingPreview, setUpcomingPreview] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [stale, setStale] = useState(false)
  const loadRef = useRef(null)

  const load = useCallback((isRetry = false) => {
    if (document.hidden) return
    setError(false)
    setStale(false)
    if (isRetry) setLoading(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetchJson(`/api/v1/today?tz=${encodeURIComponent(tz)}`)
      .then(({ data: all, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline || !Array.isArray(all)) {
          setError(true)
          return
        }
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz })
        const filtered = wcOnly ? all.filter(m => m.competition?.code === "WC") : all
        setUpcomingPreview(prev => {
          const preview = filtered.filter(m => m.upcoming_preview)
          const prevById = new Map(prev.map(m => [m.external_id ?? m.id, m]))
          return preview.map(m => mergeLiveMatchSnapshot(m, prevById.get(m.external_id ?? m.id)))
        })
        setTodayMatches(prev => {
          const next = filtered.filter(m => {
            if (m.upcoming_preview) return false
            const ko = m.kickoff_at || m.kickoff
            if (!ko) return false
            return new Date(ko).toLocaleDateString("en-CA", { timeZone: tz }) === todayStr
          })
          const prevById = new Map(prev.map(m => [m.external_id ?? m.id, m]))
          return next.map(m => mergeLiveMatchSnapshot(m, prevById.get(m.external_id ?? m.id)))
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [wcOnly])

  loadRef.current = load

  const hasLive = todayMatches.some(m => m.status === "live")
  useVisiblePolling(() => loadRef.current?.(), hasLive ? 30_000 : 300_000, [hasLive])

  useEffect(() => {
    load()
    const onVisible = () => { if (!document.hidden) loadRef.current?.() }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [load])

  const applyLiveScore = useCallback((d) => {
    const patch = prev => {
      let touched = false
      const next = prev.map(m => {
        const hit = (d.external_id != null && m.external_id === d.external_id) ||
                    (d.match_id != null && m.id === d.match_id)
        if (!hit) return m
        if (m.home_score === d.home_score && m.away_score === d.away_score &&
            m.status === d.status && m.minute === d.minute) return m
        touched = true
        return {
          ...m,
          home_score: d.home_score,
          away_score: d.away_score,
          status: d.status,
          minute: d.minute,
          minute_extra: d.minute_extra,
        }
      })
      return touched ? next : prev
    }
    setTodayMatches(patch)
    setUpcomingPreview(patch)
  }, [])
  useLiveScoresChannel(applyLiveScore)
  useStandingsChannel(load)

  return { todayMatches, upcomingPreview, loading, todayError: error, todayStale: stale, retryToday: () => load(true) }
}

const FEATURED_NEWS_LEAGUES = [ "CRC", "CAC", "CCC", "LMX", "PL", "LAL" ]

function pickHeroMatch(fixtures, preview, favName, i18n) {
  const pool = [ ...fixtures, ...preview ]
  const live = pool.filter(m => m.status === "live")
  if (live.length) {
    if (favName) {
      const favLive = live.find(m =>
        matchTeamName(m.home_team?.name, favName, i18n.language) ||
        matchTeamName(m.away_team?.name, favName, i18n.language)
      )
      if (favLive) return favLive
    }
    return [ ...live ].sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0))[0]
  }

  const upcoming = pool
    .filter(m => m.status === "scheduled" && m.kickoff_at)
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

  if (favName) {
    const favNext = upcoming.find(m =>
      matchTeamName(m.home_team?.name, favName, i18n.language) ||
      matchTeamName(m.away_team?.name, favName, i18n.language)
    )
    if (favNext) return favNext
  }

  return upcoming[0] ?? pool.find(m => m.kickoff_at && new Date(m.kickoff_at) > new Date())
}

function useLatestNews(leagueCodes = []) {
  const { i18n } = useTranslation()
  const [news, setNews]     = useState([])
  const [error, setError]   = useState(false)
  const [stale, setStale]   = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setError(false)
    setStale(false)
    setLoading(true)
    const leaguesParam = leagueCodes.length
      ? `&leagues=${encodeURIComponent(leagueCodes.join(","))}`
      : ""
    fetchJson(`/api/v1/news?lang=${i18n.language}${leaguesParam}`)
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline || !Array.isArray(data)) {
          setError(true)
          return
        }
        setNews(data.slice(0, 3))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [i18n.language, leagueCodes.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps
  return { news, newsError: error, newsStale: stale, newsLoading: loading, retryNews: load }
}

function leagueCodeFromMatches(matches, favName, lang) {
  for (const m of matches) {
    const involved = matchTeamName(m.home_team?.name, favName, lang) ||
      matchTeamName(m.away_team?.name, favName, lang)
    if (!involved) continue
    const code = m.competition?.code
    if (code && !String(code).match(/^\d+$/)) return code
  }
  return null
}

function FavoriteTeamCard({ fav, upcomingMatches, navigate, t, clubsPrimary = false, wcPaused = true, suppressLive = false }) {
  const { i18n } = useTranslation()
  const [teamUpcoming, setTeamUpcoming] = useState([])
  const [teamLoading, setTeamLoading] = useState(false)

  const matchesTeam = (name) => matchTeamName(name, fav.name, i18n.language)

  const leagueCode = fav.league_code || leagueCodeFromMatches(upcomingMatches, fav.name, i18n.language)

  useEffect(() => {
    if (!clubsPrimary || !leagueCode || !fav?.name) {
      setTeamUpcoming([])
      setTeamLoading(false)
      return
    }
    const inFeed = upcomingMatches.some(m =>
      matchesTeam(m.home_team?.name) || matchesTeam(m.away_team?.name)
    )
    if (inFeed) {
      setTeamUpcoming([])
      setTeamLoading(false)
      return
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const slug = clubTeamSlug(fav.name)
    let cancelled = false
    setTeamLoading(true)
    fetchJson(`/api/v1/club_teams/${leagueCode}/${slug}?tz=${encodeURIComponent(tz)}`, { soft: true })
      .then(({ data, ok }) => {
        if (cancelled) return
        setTeamUpcoming(ok && Array.isArray(data?.upcoming) ? data.upcoming : [])
      })
      .catch(() => { if (!cancelled) setTeamUpcoming([]) })
      .finally(() => { if (!cancelled) setTeamLoading(false) })

    return () => { cancelled = true }
  }, [clubsPrimary, leagueCode, fav?.name, upcomingMatches, i18n.language])

  const mergedMatches = (() => {
    const seen = new Set()
    return [...upcomingMatches, ...teamUpcoming].filter(m => {
      const key = m.external_id ?? m.id
      if (key == null || seen.has(key)) return false
      seen.add(key)
      return m.status === "live" || m.status === "scheduled"
    })
  })()

  const favMatches = mergedMatches.filter(m =>
    matchesTeam(m.home_team?.name) || matchesTeam(m.away_team?.name)
  )
  const next = suppressLive
    ? favMatches.find(m => m.status !== "live")
    : (favMatches.find(m => m.status === "live") || favMatches[0])
  const teamHref = leagueCode
    ? clubTeamPath(leagueCode, fav.name)
    : (/^\d+$/.test(String(fav.id)) ? `/teams/${fav.id}` : null)
  const teamLabel = translateTeam(fav.name, i18n.language) || fav.name

  return (
    <div className="favorite-team-card">
      <div className="favorite-team-card__header">
        {fav.flag_url && (
          <img src={fav.flag_url} alt="" className="logo-sm favorite-team-card__crest" onError={e => (e.target.style.display = "none")} />
        )}
        <div className="favorite-team-card__info">
          {teamHref ? (
            <Link to={teamHref} className="favorite-team-card__name">{teamLabel}</Link>
          ) : (
            <div className="favorite-team-card__name">{teamLabel}</div>
          )}
          {fav.group && !fav.league_code && !wcPaused && (
            <div className="favorite-team-card__meta">{t("nav.group", { letter: fav.group })}</div>
          )}
        </div>
      </div>

      {teamLoading ? (
        <div className="favorite-team-card__body">
          <div className="loading-shimmer" style={{ height: 52, borderRadius: 10 }} />
        </div>
      ) : next ? (
        <div className="favorite-team-card__body">
          <div className="favorite-team-card__label">
            {next.status === "live" ? t("home.playingNow") : t("hero.nextMatch")}
          </div>
          <div className="match-list match-list--compact favorite-team-card__match-list">
            <MatchRow
              match={next}
              showDate={next.status !== "live"}
              showMeta={false}
              onClick={() => navigateToMatch(navigate, next)}
            />
          </div>
        </div>
      ) : (
        <div className="favorite-team-card__body favorite-team-card__body--empty">
          {t("home.noUpcoming")}
        </div>
      )}
    </div>
  )
}

const STATUS_ORDER = { live: 0, finished: 1, scheduled: 2 }

function groupMatchesByCompetition(matches) {
  const map = new Map()
  for (const m of matches) {
    const key = m.competition?.code ?? m.competition?.name ?? "other"
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(m)
  }
  return sortCompetitionGroups([...map.values()].map(items =>
    [ ...items ].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 3
      const sb = STATUS_ORDER[b.status] ?? 3
      return sa - sb || new Date(a.kickoff_at || 0) - new Date(b.kickoff_at || 0)
    })
  ))
}

function CompetitionGroupHeader({ match, navigate, i18n }) {
  const comp = match?.competition
  if (!comp) return null
  const code = comp.code
  const canNav = code && !String(code).match(/^\d+$/)
  const leagueName = translateLeague(comp.name, i18n.language) ?? comp.name
  const regionLabel = competitionRegion(comp, i18n.language)

  return (
    <div
      role={canNav ? "button" : undefined}
      tabIndex={canNav ? 0 : undefined}
      onClick={canNav ? () => navigate(`/leagues/${code}`) : undefined}
      onKeyDown={canNav ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          navigate(`/leagues/${code}`)
        }
      } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "var(--surface2)",
        borderBottom: "1px solid var(--border)",
        cursor: canNav ? "pointer" : "default",
      }}
    >
      <FlagImg src={comp.logo} name={comp.name} size={18} className="logo-sm" />
      <span style={{ fontWeight: 800, fontSize: ".72rem", color: "var(--text)", flex: 1 }}>
        {leagueName}
      </span>
      {regionLabel && (
        <span style={{ fontSize: ".62rem", color: "var(--muted)" }}>
          {regionLabel}
        </span>
      )}
      {canNav && <span style={{ color: "var(--muted)", fontSize: ".7rem" }}>→</span>}
    </div>
  )
}

// ─── Today's matches strip ────────────────────────────────────────────────────
function TodayFeedSkeleton() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="loading-shimmer" style={{ height: 14, width: 120, borderRadius: 6, marginBottom: 10 }} />
      <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ padding: "14px 16px", borderBottom: i < 3 ? "1px solid var(--border)" : "none" }}>
            <div className="loading-shimmer" style={{ height: 36, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TodayMatchesSection({ todayMatches, upcomingPreview = [], loading = false, error = false, onRetry, navigate, t, clubsPrimary = false, favoriteTeamNames = [] }) {
  const { i18n } = useTranslation()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const todayLabel = new Date().toLocaleDateString(i18n.language || undefined, {
    weekday: "long", month: "long", day: "numeric", timeZone: tz,
  })

  if (loading) return <TodayFeedSkeleton />

  const errorBanner = error && (
    <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.82rem", marginBottom: 12 }}>
      {t("error.tryAgain", "Couldn't load matches. Check your connection.")}
      <button onClick={onRetry} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}>
        {t("error.retry", "Retry")}
      </button>
    </div>
  )

  const all = [...(todayMatches || [])]
    .sort((a, b) => new Date(a.kickoff_at || a.kickoff) - new Date(b.kickoff_at || b.kickoff))
  const live      = all.filter(m => m.status === "live")
  const rest      = all.filter(m => m.status !== "live")

  const yourMatchKeys = clubsPrimary && favoriteTeamNames.length > 0
    ? new Set(
        rest
          .filter(m =>
            favoriteTeamNames.some(name =>
              matchTeamName(m.home_team?.name, name, i18n.language) ||
              matchTeamName(m.away_team?.name, name, i18n.language)
            )
          )
          .map(matchKey)
          .filter(Boolean)
      )
    : null

  const restForGroups = yourMatchKeys?.size
    ? rest.filter(m => !yourMatchKeys.has(matchKey(m)))
    : rest

  const liveCount = live.length
  const restGroups = groupMatchesByCompetition(restForGroups)
  const previewDayLabel = upcomingPreview[0]?.kickoff_at
    ? new Date(upcomingPreview[0].kickoff_at).toLocaleDateString(i18n.language || undefined, {
        weekday: "long", month: "short", day: "numeric",
      })
    : null

  const sectionHeader = (count) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: "1rem", color: "var(--text)" }}>
          {t("scores.tabToday", "Today")}
        </div>
        <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 2 }}>
          {todayLabel}
          {count > 0 && (
            <span> · {t("time.matchCount", { count, defaultValue: "{{count}} matches" })}</span>
          )}
        </div>
      </div>
      <Link
        to="/scores/today"
        style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
      >
        {t("home.viewAll")}
      </Link>
    </div>
  )

  const renderMatchGroups = (groups, { limit } = {}) => {
    let shown = 0
    const cap = limit ?? Infinity
    return groups.map((group, gi) => {
      if (shown >= cap) return null
      const slice = group.slice(0, cap - shown)
      shown += slice.length
      return (
        <div
          key={`${group[0]?.competition?.code ?? gi}-${gi}`}
          style={{
            background: "var(--surface)", borderRadius: 12, overflow: "hidden",
            border: "1px solid var(--border)", marginBottom: gi < groups.length - 1 ? 10 : 0,
          }}
        >
          <CompetitionGroupHeader match={group[0]} navigate={navigate} i18n={i18n} />
          {slice.map((m, i) => (
            <div key={m.id} style={{ borderBottom: i < slice.length - 1 ? "1px solid var(--border)" : "none" }}>
              <MatchRow match={m} showDate={false} onClick={() => navigateToMatch(navigate, m)} />
            </div>
          ))}
        </div>
      )
    })
  }

  if (all.length === 0 && upcomingPreview.length === 0) {
    return (
      <>
        {sectionHeader(0)}
        {errorBanner}
        {!error && (
          <EmptyState
            icon="📅"
            title={t("scores.noMatchesToday", "No matches today")}
            description={clubsPrimary ? t("home.liveScoresWorldwide") : t("scores.wcSubtitle")}
            action={
              <Link to="/scores/today" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                {t("scores.tabToday", "Today")}
              </Link>
            }
          />
        )}
      </>
    )
  }

  if (all.length === 0 && upcomingPreview.length > 0) {
    return (
      <div style={{ marginBottom: 8 }}>
        {sectionHeader(0)}
        <EmptyState
          icon="📅"
          title={t("scores.noMatchesToday", "No matches today")}
          description={t("scores.tryDifferent", "Try another date")}
        />
        <div style={{ marginTop: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 4px 10px",
            fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)",
            textTransform: "uppercase", letterSpacing: 1,
          }}>
            {`${t("home.upcomingMatches")}${previewDayLabel ? ` — ${previewDayLabel}` : ""}`}
          </div>
          <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            {upcomingPreview.slice(0, 6).map((m, i) => (
              <div key={m.id} style={{ borderBottom: i < Math.min(upcomingPreview.length, 6) - 1 ? "1px solid var(--border)" : "none" }}>
                <MatchRow match={m} showDate onClick={() => navigateToMatch(navigate, m)} />
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link to="/scores/today" className="btn btn-outline-light btn-sm">
              {t("home.fullSchedule")}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {sectionHeader(all.length)}
      {errorBanner}
      {/* ── LIVE NOW banner — only shown when matches are in progress ── */}
      {liveCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span className="live-dot" />
              <span style={{ fontWeight: 900, fontSize: ".82rem", color: "var(--accent)", letterSpacing: ".04em" }}>
                {t("scores.liveNow")}
              </span>
              <span style={{ fontSize: ".68rem", color: "var(--muted)" }}>
                · {liveCount} {liveCount === 1 ? t("scores.match") : t("scores.matches")}
              </span>
            </div>
          </div>
          <div style={{ background: "rgba(238,30,70,.06)", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(238,30,70,.2)" }}>
            {live.map((m, i) => (
              <div key={m.id} style={{ borderBottom: i < live.length - 1 ? "1px solid rgba(238,30,70,.12)" : "none" }}>
                <MatchRow
                  match={m}
                  showDate={false}
                  onClick={() => navigateToMatch(navigate, m)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Today (non-live), grouped by competition ── */}
      {restForGroups.length > 0 && (
        <div>
          {renderMatchGroups(restGroups, { limit: 8 })}
          {restForGroups.length > 8 && (
            <Link
              to="/scores/today"
              style={{
                display: "block", width: "100%", marginTop: 10, textAlign: "center",
                background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)",
                borderRadius: 8, padding: "9px", fontSize: ".72rem", fontWeight: 700, textDecoration: "none",
              }}
            >
              {t("home.moreMatches", { count: restForGroups.length - 8 })}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Your matches (followed teams) ────────────────────────────────────────────
function YourMatchesSection({ todayMatches, favoriteTeamNames, navigate, t, excludeLive = false }) {
  const { i18n } = useTranslation()
  const yourMatches = favoriteTeamNames.length > 0
    ? todayMatches.filter(m =>
        favoriteTeamNames.some(name =>
          matchTeamName(m.home_team?.name, name, i18n.language) || matchTeamName(m.away_team?.name, name, i18n.language)
        )
      )
    : []
  const visible = excludeLive ? yourMatches.filter(m => m.status !== "live") : yourMatches

  if (visible.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1,
      }}>
        <span>★</span> {t("scores.yourMatches")}
      </div>
      <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
        {visible.map((m, i) => (
          <div key={m.id} style={{ borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none" }}>
            <MatchRow match={m} showDate={false} onClick={() => navigateToMatch(navigate, m)} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── News card (no fallback arcade images) ────────────────────────────────────
const PLACEHOLDER_COLORS = ["#1a1f2e", "#1a1420", "#0f1a1a"]
const PLACEHOLDER_EMOJIS = ["⚽", "🏆", "🗞️"]

function NewsThumbnail({ post, index }) {
  const bg    = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]
  const emoji = PLACEHOLDER_EMOJIS[index % PLACEHOLDER_EMOJIS.length]
  const placeholderStyle = {
    aspectRatio: "16/9", background: bg, borderRadius: "8px 8px 0 0",
    display: "flex", alignItems: "flex-start", justifyContent: "flex-start",
    padding: 16, fontSize: "1.4rem", opacity: 0.55,
  }
  if (!post.image) return <div style={placeholderStyle}>{emoji}</div>
  return (
    <>
      <img
        src={post.image} alt={post.title || ""} className="img-fluid"
        onError={e => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex" }}
      />
      <div style={{ ...placeholderStyle, display: "none" }}>{emoji}</div>
    </>
  )
}

function NewsCard({ post, index }) {
  const { i18n } = useTranslation()
  const dateLabel = post?.published_at
    ? new Date(post.published_at).toLocaleDateString(i18n.language || undefined, {
        day: "numeric", month: "short", year: "numeric",
      })
    : post?.date_label

  return (
    <div className="home-news-card">
      <Link
        to={post?.id ? `/news/${post.id}` : "#"}
        className="home-news-card__link"
        style={{ pointerEvents: post ? "auto" : "none" }}
        ref={el => post?.id && attachNewsPrefetch(el, post.id, i18n.language.split("-")[0])}
      >
        <div className="post-entry">
          {post ? (
            <NewsThumbnail post={post} index={index} />
          ) : (
            <div className="loading-shimmer" style={{ aspectRatio: "16/9", borderRadius: "8px 8px 0 0" }} />
          )}
          <div className="caption">
            <div className="caption-inner">
              {post ? (
                <>
                  <h3 className="mb-3">{post.title}</h3>
                  <div className="author d-flex align-items-center">
                    <div className="text">
                      <h4>{post.source}</h4>
                      <span>{dateLabel}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="loading-shimmer" style={{ height: 60, borderRadius: 8 }} />
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
export default function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const liveCountGlobal = useLiveCount()
  const [fav]      = useFavoriteTeam()
  const { favoriteCompetitions, favoriteTeamNames } = useFavorites()
  const { clubs_primary: clubsPrimary, wc_paused: wcPaused = true } = useAppFocus()

  usePageMeta(
    clubsPrimary ? t("home.metaTitleClubs") : t("home.metaTitleWC"),
    clubsPrimary ? t("home.metaDescClubs") : t("home.metaDescWC")
  )
  useStructuredData(wcPaused ? null : {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": "FIFA World Cup 2026",
    "alternateName": "Mundial 2026",
    "description": "The 2026 FIFA World Cup hosted across the United States, Canada and Mexico. Live scores, fixtures, standings and stats.",
    "startDate": "2026-06-11",
    "endDate": "2026-07-19",
    "location": { "@type": "Place", "name": "United States, Canada and Mexico" },
    "organizer": { "@type": "Organization", "name": "FIFA", "url": "https://www.fifa.com" },
    "url": "https://golazo.app/world-cup-2026"
  })

  const { matches: upcomingMatches, refetch: refetchUpcoming, stale: matchesStale } = useMatches("upcoming", {
    competition: "WC",
    enabled: !clubsPrimary,
  })
  useLiveScoresChannel(patchLiveScore)
  const { todayMatches, upcomingPreview, loading: todayLoading, todayError, todayStale, retryToday } = useTodayFeed(!clubsPrimary)
  const todayLiveCount = useMemo(
    () => todayMatches.filter(m => m.status === "live").length,
    [todayMatches]
  )
  const liveCount = todayLiveCount > 0 ? todayLiveCount : liveCountGlobal
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz })
  const clubFixtures = clubsPrimary
    ? [...todayMatches, ...upcomingPreview]
        .filter(m => m.status === "live" || m.status === "scheduled")
        .sort((a, b) => new Date(a.kickoff_at || 0) - new Date(b.kickoff_at || 0))
    : []
  const favUpcoming = clubsPrimary ? clubFixtures : upcomingMatches
  const newsLeagues = clubsPrimary
    ? [...new Set(favoriteCompetitions.map(f => f.code).filter(Boolean))]
    : []
  const newsLeagueFilter = newsLeagues.length > 0 ? newsLeagues : (clubsPrimary ? FEATURED_NEWS_LEAGUES : [])
  const { news: latestNews, newsError, newsStale, newsLoading, retryNews } = useLatestNews(newsLeagueFilter)

  // Prefer the next match with a known future kickoff; only fall back to TBD
  // if nothing has a time yet (avoids showing a placeholder knockout slot in hero).
  const nextMatch = clubsPrimary
    ? pickHeroMatch(clubFixtures, upcomingPreview, fav?.name, i18n)
    : upcomingMatches.find(m => m.kickoff_at && new Date(m.kickoff_at) > new Date())
      ?? upcomingMatches.find(m => !m.kickoff_at)

  const upcomingSource = clubsPrimary ? clubFixtures : upcomingMatches
  const upcomingFuture = upcomingSource.filter(m =>
    m.id !== nextMatch?.id &&
    m.kickoff_at &&
    new Date(m.kickoff_at).toLocaleDateString("en-CA", { timeZone: tz }) !== todayStr
  )

  const refreshAll = useCallback(() => {
    retryToday()
    retryNews()
    refetchUpcoming()
  }, [retryToday, retryNews, refetchUpcoming])

  const ptr = usePullRefresh(refreshAll, { disabled: todayLoading && newsLoading })

  return (
    <div
      onTouchStart={ptr.onTouchStart}
      onTouchMove={ptr.onTouchMove}
      onTouchEnd={ptr.onTouchEnd}
    >
      {ptr.showIndicator && <PullIndicator distance={ptr.pullDist} refreshing={ptr.refreshing} />}
    <>
      <Hero nextMatch={nextMatch} liveCount={liveCount} clubsPrimary={clubsPrimary} />

      <div className="container">
        <OfflineBanner stale={todayStale || newsStale || matchesStale} onRetry={refreshAll} />
      </div>

      <div className="container home-today-section" style={{ paddingTop: clubsPrimary ? 12 : 24, paddingBottom: 0 }}>
        <TodayMatchesSection
          todayMatches={todayMatches}
          upcomingPreview={upcomingPreview}
          loading={todayLoading}
          error={todayError}
          onRetry={retryToday}
          navigate={navigate}
          t={t}
          clubsPrimary={clubsPrimary}
          favoriteTeamNames={favoriteTeamNames}
        />
        {clubsPrimary && favoriteTeamNames.length > 0 && (
          <YourMatchesSection
            todayMatches={todayMatches}
            favoriteTeamNames={favoriteTeamNames}
            navigate={navigate}
            t={t}
            excludeLive={todayLiveCount > 0}
          />
        )}
      </div>

      {clubsPrimary && (
        <div className="container" style={{ paddingTop: 16, paddingBottom: 0 }}>
          <ClubCompetitionChips />
        </div>
      )}

      {/* ── Favorite team section ── */}
      <div className="container" style={{ paddingTop: 16, paddingBottom: 4 }}>
        <div className="home-favorite-bar" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
            {fav ? t("home.yourTeam", "Your Team") : t("home.followTeam", "Follow a team")}
          </span>
          <FavoriteTeamPicker />
        </div>
        {fav ? (
          <FavoriteTeamCard fav={fav} upcomingMatches={favUpcoming} navigate={navigate} t={t} clubsPrimary={clubsPrimary} wcPaused={wcPaused} suppressLive={todayLiveCount > 0} />
        ) : (
          <div className="home-follow-cta">
            <p>{t(clubsPrimary ? "news.forYouEmptyHintClubs" : "news.forYouEmptyHint")}</p>
            {clubsPrimary && (
              <Link to="/leagues" className="btn btn-primary btn-sm">{t("nav.leagues")}</Link>
            )}
          </div>
        )}
      </div>

      {/* ── Latest News ── */}
      <div className="latest-news">
        <div className="container">
          <div className="row">
            <div className="col-12 title-section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 className="heading" style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>{t("home.latestNews")}</h2>
              <Link to="/news" style={{ fontSize: ".78rem", color: "var(--accent)", textDecoration: "none", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                {t("home.viewAll")}
              </Link>
            </div>
          </div>
          {newsError && (
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="col-12" style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
                {t("error.newsUnavailable", "Couldn't load news.")}
                <button onClick={retryNews} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}>
                  {t("error.retry", "Retry")}
                </button>
              </div>
            </div>
          )}
          <div className="home-news-scroll">
            {newsLoading ? (
              [0, 1, 2].map(i => (
                <div key={i} className="home-news-card home-news-card--loading">
                  <div className="loading-shimmer" style={{ aspectRatio: "16/9", borderRadius: "10px 10px 0 0" }} />
                  <div className="loading-shimmer" style={{ height: 60, borderRadius: 8, margin: 12 }} />
                </div>
              ))
            ) : newsError ? (
              <div className="home-news-scroll__empty">
                <EmptyState
                  icon="🗞️"
                  title={t("error.newsUnavailable", "Couldn't load news.")}
                  action={
                    <button type="button" className="btn btn-primary btn-sm mt-3" onClick={retryNews}>
                      {t("error.retry", "Retry")}
                    </button>
                  }
                />
              </div>
            ) : latestNews.length === 0 ? (
              <div className="home-news-scroll__empty">
                <EmptyState
                  icon="🗞️"
                  title={t("news.noArticles")}
                  action={
                    <Link to="/news" className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                      {t("news.allNews")}
                    </Link>
                  }
                />
              </div>
            ) : (
              latestNews.map((post, i) => (
                <NewsCard key={post.id} post={post} index={i} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Quick-links: clubs hub ── */}
      {clubsPrimary && (
        <div className="site-section home-quick-section">
          <div className="container">
            <div className="home-quick-links">
              {[
                { label: `📅 ${t("time.today")}`, path: "/scores/today" },
                { label: `📊 ${t("nav.results")}`, path: "/scores/results" },
                { label: `🏆 ${t("nav.allLeagues")}`, path: "/leagues" },
                { label: `📰 ${t("nav.news")}`, path: "/news" },
                { label: `⚔️ ${t("teamComparison.compare")}`, path: "/compare/teams" },
                { label: `🎯 ${t("nav.predictor")}`, path: "/predictor" },
              ].map(({ label, path }) => (
                <Link key={path} to={path} className="home-quick-links__chip">{label}</Link>
              ))}
            </div>
            <details className="home-wc-archive">
              <summary>{t("nav.mundial")} · {t("leagues.archived", "Archived")}</summary>
              <div className="home-quick-links home-quick-links--archive">
                {[
                  { label: `🏆 ${t("nav.mundialShort")}`, path: "/world-cup-2026" },
                  { label: `📅 ${t("nav.schedule")}`, path: "/mundial/schedule" },
                  { label: `📊 ${t("nav.groups")}`, path: "/mundial/groups" },
                  { label: `🏆 ${t("nav.knockout")}`, path: "/mundial/knockout" },
                ].map(({ label, path }) => (
                  <Link key={path} to={path} className="home-quick-links__chip">{label}</Link>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ── Quick-links section: World Cup + Competitions (WC mode only) ── */}
      {!wcPaused && <div className="site-section" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <div className="container">
          <div className="row" style={{ gap: "0 0" }}>
            <>
            {/* World Cup 2026 hub */}
            <div className="col-md-6" style={{ marginBottom: 20 }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(238,30,70,.1) 0%, rgba(238,30,70,.03) 100%)",
                border: "1px solid rgba(238,30,70,.2)", borderRadius: 14, padding: "20px 24px",
              }}>
                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
                  {t("home.wcSectionTitle")}
                </div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
                  {t("home.wcHosts")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: `📅 ${t("nav.schedule")}`,  path: "/mundial/schedule" },
                    { label: `📊 ${t("nav.groups")}`,    path: "/mundial/groups" },
                    { label: `🏆 ${t("nav.knockout")}`,  path: "/mundial/knockout" },
                    { label: `🎯 ${t("nav.predictor", "Predictor")}`, path: "/predictor" },
                    { label: `📊 ${t("nav.leaderboard", "Leaderboard")}`, path: "/leaderboard" },
                    { label: `⭐ ${t("mundial.tabGoals")}`,   path: "/mundial/scorers" },
                    { label: `🏟️ ${t("nav.venues")}`,   path: "/mundial/venues" },
                    { label: `👥 ${t("nav.teams")}`,     path: "/mundial/teams" },
                  ].map(({ label, path }) => (
                    <Link key={path} to={path} style={{
                      display: "inline-block",
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "6px 12px",
                      fontSize: ".7rem", fontWeight: 700, color: "var(--text)", textDecoration: "none",
                    }}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Club competitions */}
            <div className="col-md-6" style={{ marginBottom: 20 }}>
              <ClubCompetitionChips />
            </div>
            </>
          </div>
        </div>
      </div>}

      {/* ── Next match widget + upcoming ── */}
      {(nextMatch || upcomingFuture.length > 0) && !wcPaused && <div className="site-section bg-dark">
        <div className="container">
          <div className="row">

            {/* Next match widget */}
            <div className="col-lg-6">
              {nextMatch && (
                <div className="widget-next-match">
                  <div className="widget-title">
                    <h3>{t("home.nextMatch")}</h3>
                  </div>
                  <div className="widget-body mb-1">
                    <div className="widget-vs">
                      <div className="d-flex align-items-center justify-content-around justify-content-between w-100">
                        <div className="team-1 text-center">
                          {nextMatch.home_team?.flag_url
                            ? <img src={nextMatch.home_team.flag_url} alt={nextMatch.home_team.name} className="logo-md" style={{ margin: "0 auto" }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{translateTeam(nextMatch.home_team?.name, i18n.language)}</h3>
                        </div>
                        <div><span className="vs"><span>VS</span></span></div>
                        <div className="team-2 text-center">
                          {nextMatch.away_team?.flag_url
                            ? <img src={nextMatch.away_team.flag_url} alt={nextMatch.away_team.name} className="logo-md" style={{ margin: "0 auto" }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{translateTeam(nextMatch.away_team?.name, i18n.language)}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center widget-vs-contents mb-2">
                    <h4>{clubsPrimary ? (nextMatch.round || nextMatch.competition?.name) : (nextMatch.round || nextMatch.group_stage)}</h4>
                    <p className="mb-2">
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleString(i18n.language || undefined, { month: "long", day: "numeric", year: "numeric" })
                          : t("time.tbd")}
                      </span>
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleTimeString(i18n.language || undefined, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
                          : ""}
                      </span>
                      <strong className="text-primary">{nextMatch.venue}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming fixtures */}
            <div className="col-lg-6">
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>{t("home.upcomingMatches")}</h3>
                </div>

                {/* Desktop table */}
                <div className="d-none d-md-block">
                  <table className="table custom-table">
                    <thead>
                      <tr>
                        <th>{t("table.date")}</th>
                        <th>{t("table.home")}</th>
                        <th></th>
                        <th>{t("table.away")}</th>
                        <th>{clubsPrimary ? t("match.round", "Round") : t("table.group")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingFuture.slice(0, 8).map(m => {
                        const homeLabel = translateTeam(m.home_team?.name, i18n.language) || m.home_team?.code
                        const awayLabel = translateTeam(m.away_team?.name, i18n.language) || m.away_team?.code
                        const goToMatch = () => (navIdFor(m) ? navigateToMatch(navigate, m) : navigate("/scores/today"))
                        return (
                          <tr
                            key={m.id}
                            role="button"
                            tabIndex={0}
                            style={{ cursor: "pointer" }}
                            aria-label={t("a11y.matchRow", { home: homeLabel, away: awayLabel })}
                            onClick={goToMatch}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                goToMatch()
                              }
                            }}
                          >
                            <td style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" }) : t("time.tbd")}
                            </td>
                            <td>
                              <div className="d-flex align-items-center" style={{ gap: 6 }}>
                                {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt={m.home_team.name} className="flag-xs" />}
                                <strong style={{ color: "var(--text)" }}>{m.home_team?.code}</strong>
                              </div>
                            </td>
                            <td style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{t("status.vs")}</td>
                            <td>
                              <div className="d-flex align-items-center" style={{ gap: 6 }}>
                                {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt={m.away_team.name} className="flag-xs" />}
                                <strong style={{ color: "var(--text)" }}>{m.away_team?.code}</strong>
                              </div>
                            </td>
                            <td style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                              {clubsPrimary ? (m.round || m.competition?.code) : m.group_stage}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile rows */}
                <div className="d-md-none widget-body p-0">
                  {upcomingFuture.slice(0, 6).map(m => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      showDate
                      showMeta
                      onClick={() => (navIdFor(m) ? navigateToMatch(navigate, m) : navigate("/scores/today"))}
                    />
                  ))}
                </div>

                <div className="text-center mt-3">
                  <Link to="/scores/today" style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                    {t("home.fullSchedule")}
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>}

    </>
    </div>
  )
}
