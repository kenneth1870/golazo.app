import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../../i18n/leagueNames"
import MatchRow from "../../components/MatchRow"
import EmptyState from "../../components/EmptyState"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useAppFocus } from "../../hooks/useAppFocus"
import { useVisiblePolling } from "../../hooks/useVisiblePolling"
import { usePullRefresh } from "../../hooks/usePullRefresh"
import PullIndicator from "../../components/PullIndicator"
import OfflineBanner from "../../components/OfflineBanner"
import { fetchJson } from "../../utils/fetchJson"
import { navigateToMatch } from "../../utils/matchDetailCache"

function toMatchRowMatch(m) {
  return {
    external_id: m.external_id,
    id: m.external_id,
    status: "live",
    minute: m.minute,
    minute_extra: m.minute_extra,
    home_score: m.home?.score ?? null,
    away_score: m.away?.score ?? null,
    home_red_cards: m.home?.red_cards ?? 0,
    away_red_cards: m.away?.red_cards ?? 0,
    home_team: { name: m.home?.name, flag_url: m.home?.logo },
    away_team: { name: m.away?.name, flag_url: m.away?.logo },
  }
}

function CompetitionBlock({ leagueName, leagueLogo, leagueCountry, matches, onMatchClick }) {
  const { t, i18n } = useTranslation()
  const sorted = [...matches].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))

  return (
    <div className="widget-next-match mb-4">
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        {leagueLogo && (
          <img src={leagueLogo} alt="" className="logo-sm" loading="eager"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{translateLeague(leagueName, i18n.language) ?? "Live"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--muted)" }}>{leagueCountry}</span>
        <span className="live-badge">{t("status.live")}</span>
      </div>
      <div className="widget-body p-0">
        {sorted.map((m, i) => (
          <MatchRow
            key={m.external_id ?? i}
            match={toMatchRowMatch(m)}
            metaLabel={m.venue || undefined}
            showChevron
            showMeta
            onClick={() => onMatchClick(m)}
          />
        ))}
      </div>
    </div>
  )
}

export default function LivePage() {
  const { t } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  usePageMeta(t("nav.live"), t("scores.metaDesc"))
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [stale, setStale]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const navigate = useNavigate()
  const onMatchClick = (match) => navigateToMatch(navigate, match)

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    setError(false)
    setStale(false)
    return fetchJson("/api/v1/live_scores")
      .then(({ data, ok, offline, stale: isStale }) => {
        setStale(isStale)
        if (!ok || offline || !Array.isArray(data)) {
          setError(true)
          return
        }
        setMatches(data)
        setLastUpdated(new Date())
      })
      .catch(() => setError(true))
      .finally(() => { if (!isRefresh) setLoading(false) })
  }, [])

  const ptr = usePullRefresh(() => load(true), { disabled: loading && !matches.length })

  useEffect(() => { load() }, [load])

  useVisiblePolling(() => load(true), 30000)

  const byLeague = matches.reduce((acc, m) => {
    const key = m.league_id ?? m.league_name ?? "other"
    if (!acc[key]) acc[key] = { leagueName: m.league_name, leagueLogo: m.league_logo, leagueCountry: m.league_country, matches: [] }
    acc[key].matches.push(m)
    return acc
  }, {})

  const groups = Object.values(byLeague).sort((a, b) =>
    (a.leagueName ?? "").localeCompare(b.leagueName ?? "")
  )

  if (loading && matches.length === 0) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (error && matches.length === 0) {
    return (
      <div className="site-section">
        <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
          <EmptyState
            icon="⚠️"
            title={t("error.failedToLoad")}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => load()}>
                {t("error.retry")}
              </button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="site-section"
      onTouchStart={ptr.onTouchStart}
      onTouchMove={ptr.onTouchMove}
      onTouchEnd={ptr.onTouchEnd}
    >
      {ptr.showIndicator && <PullIndicator distance={ptr.pullDist} refreshing={ptr.refreshing} />}
      <div className="container">
        <OfflineBanner stale={stale} onRetry={() => load(true)} />

        <div className="d-flex align-items-center justify-content-between mb-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontWeight: 600 }}>{t("live.matchesLive", { count: matches.length })}</span>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              {t("live.updated")} {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              <span style={{ marginLeft: 6 }}>· {t("live.refreshes")}</span>
            </span>
          )}
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon="⚽"
            title={clubsPrimary ? t("scores.noLiveClubs") : t("scores.noLive")}
            description={t("live.checkBack")}
          />
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock
              key={g.leagueName ?? i}
              leagueName={g.leagueName}
              leagueLogo={g.leagueLogo}
              leagueCountry={g.leagueCountry}
              matches={g.matches}
              onMatchClick={onMatchClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
