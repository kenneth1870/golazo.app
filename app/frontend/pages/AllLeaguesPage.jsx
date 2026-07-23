import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { useAppFocus } from "../hooks/useAppFocus"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"
import PullIndicator from "../components/PullIndicator"
import EmptyState from "../components/EmptyState"
import { usePullRefresh } from "../hooks/usePullRefresh"
import { translateLeague, translateCountry } from "../i18n/leagueNames"

const TYPE_ORDER = { world_cup: 0, latam: 1, cup: 2, league: 3 }
const LATAM_CODES = ["CRC", "LMX"]

function LeagueCard({ competition, liveCount, onClick, lang, t }) {
  const leagueName = translateLeague(competition.name, lang) ?? competition.name

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(e)
    }
  }

  return (
    <div
      className="league-card"
      role="button"
      tabIndex={0}
      aria-label={t("a11y.viewLeague", { name: leagueName })}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ cursor: "pointer" }}
    >
      <div className="league-card__logo">
        {competition.logo ? (
          <img
            src={competition.logo}
            alt={competition.name}
            onError={e => (e.target.style.display = "none")}
          />
        ) : (
          <span className="league-card__placeholder">⚽</span>
        )}
      </div>
      <div className="league-card__body">
        <div className="league-card__name">{leagueName}</div>
        <div className="league-card__country">
          {competition.archived
            ? t("leagues.archived", "Archived")
            : (translateCountry(competition.country, lang) ?? competition.country)}
        </div>
      </div>
      {competition.archived && (
        <span style={{
          fontSize: "0.62rem", fontWeight: 800, color: "var(--muted)",
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "2px 8px", flexShrink: 0,
        }}>
          {t("nav.mundialShort", "WC 2026")}
        </span>
      )}
      {liveCount > 0 && (
        <div className="league-card__live">
          <span className="live-dot" />
          {liveCount}
        </div>
      )}
    </div>
  )
}

export default function AllLeaguesPage() {
  const { t, i18n } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  usePageMeta(t("leagues.title"), t("leagues.metaDesc"))
  const [competitions, setCompetitions] = useState([])
  const [liveMatches, setLiveMatches]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(false)
  const [stale, setStale]               = useState(false)
  const navigate = useNavigate()

  const loadLive = () => {
    if (document.hidden) return
    fetchJson("/api/v1/live_scores")
      .then(({ data, ok }) => { if (ok && Array.isArray(data)) setLiveMatches(data) })
      .catch(() => {})
  }

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    setStale(false)
    fetchJson("/api/v1/competitions")
      .then(({ data: comps, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) {
          setError(true)
          return
        }
        if (Array.isArray(comps)) setCompetitions(comps)
        loadLive()
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ptr = usePullRefresh(() => load(), { disabled: loading })

  useEffect(() => {
    load()
    const onVisible = () => { if (!document.hidden) loadLive() }
    document.addEventListener("visibilitychange", onVisible)
    const iv = setInterval(loadLive, 30_000)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Count live matches per competition, matched by external league_id
  const liveByExternalId = liveMatches.reduce((acc, m) => {
    const id = m.league_id
    if (id) acc[id] = (acc[id] || 0) + 1
    return acc
  }, {})

  // Map DB competition external_id → live count
  const liveByCode = competitions.reduce((acc, c) => {
    const count = liveByExternalId[c.external_id] || 0
    if (count > 0) acc[c.code] = count
    return acc
  }, {})

  // Pin Liga Tica + Liga MX at the top in clubs mode
  const latamLeagues = clubsPrimary
    ? competitions.filter(c => LATAM_CODES.includes(c.code))
    : []
  const otherComps = clubsPrimary
    ? competitions.filter(c => !LATAM_CODES.includes(c.code))
    : competitions

  // Group remaining competitions by type
  const byType = otherComps.reduce((acc, c) => {
    const type = c.competition_type || "league"
    if (!acc[type]) acc[type] = []
    acc[type].push(c)
    return acc
  }, {})

  if (latamLeagues.length > 0) {
    byType.latam = latamLeagues
  }

  const sortedTypes = Object.keys(byType).sort(
    (a, b) => (TYPE_ORDER[a] ?? 9) - (TYPE_ORDER[b] ?? 9)
  )

  const totalLive = liveMatches.length

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="site-section">
        <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
          <button className="btn btn-primary btn-sm" onClick={load}>{t("error.retry")}</button>
        </div>
      </div>
    )
  }

  return (
    <div
      onTouchStart={ptr.onTouchStart}
      onTouchMove={ptr.onTouchMove}
      onTouchEnd={ptr.onTouchEnd}
    >
      {ptr.showIndicator && <PullIndicator distance={ptr.pullDist} refreshing={ptr.refreshing} />}
      <OfflineBanner stale={stale} onRetry={load} />
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("leagues.title")}</h1>
          <p className="page-hero__sub">
            {totalLive > 0
              ? t("leagues.subtitle", { count: totalLive, comps: competitions.length })
              : t("leagues.available", { count: competitions.length })}
          </p>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {/* Live worldwide banner */}
          {totalLive > 0 && (
            <div
              className="widget-next-match mb-5"
              style={{ borderLeft: "3px solid var(--accent)", cursor: "pointer" }}
              onClick={() => navigate("/scores/today")}
            >
              <div className="widget-title d-flex align-items-center" style={{ gap: 8 }}>
                <span className="live-dot" />
                <h3 style={{ margin: 0 }}>{t("leagues.subtitle", { count: totalLive, comps: competitions.length })}</h3>
                <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--accent)" }}>
                  {t("home.viewAll")}
                </span>
              </div>
            </div>
          )}

          {/* Competitions grouped by type */}
          {sortedTypes.map(type => (
            <div key={type} className="mb-5">
              <div className="title-section">
                <h2 className="heading">
                  {type === "latam"
                    ? t("leagues.type_latam", "Centroamérica")
                    : t(`leagues.type_${type}`, type)}
                </h2>
              </div>
              <div className="leagues-grid">
                {byType[type].map(c => (
                  <LeagueCard
                    key={c.id}
                    competition={c}
                    liveCount={liveByCode[c.code] ?? 0}
                    lang={i18n.language}
                    t={t}
                    onClick={() => navigate(c.code === "WC" ? "/world-cup-2026" : `/leagues/${c.code}`)}
                  />
                ))}
              </div>
            </div>
          ))}

          {competitions.length === 0 && (
            <EmptyState
              icon="🌍"
              title={t("leagues.available", { count: 0 })}
              description={t("leagues.checkBack")}
            />
          )}
        </div>
      </div>
    </div>
  )
}
