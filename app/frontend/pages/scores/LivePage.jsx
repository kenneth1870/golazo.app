import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../../i18n/leagueNames"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useVisiblePolling } from "../../hooks/useVisiblePolling"
import { fetchWithTimeout } from "../../utils/fetchWithTimeout"
import { prefetchMatchDetail, navIdFor, navigateToMatch } from "../../utils/matchDetailCache"

function LiveMatchRow({ match, onMatchClick }) {
  const { t } = useTranslation()
  const hasScore = match.home?.score !== null && match.away?.score !== null

  const warm = () => prefetchMatchDetail(navIdFor(match))

  return (
    <div className="match-row match-row--live match-row--clickable" onClick={() => onMatchClick(match)}
      onMouseEnter={warm} onTouchStart={warm}>
      <div className="match-row__status">
        <span className="match-status-live">
          <span className="live-dot" />
          {match.minute ? `${match.minute}'` : t("status.live")}
        </span>
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home?.logo && (
            <img src={match.home.logo} alt={match.home.name} className="flag-xs" loading="eager"
              onError={e => (e.target.style.display = "none")} />
          )}
          <span className="team-name">{match.home?.name}</span>
          {match.home?.red_cards > 0 && (
            <span className="red-card-badge">🟥{match.home.red_cards > 1 ? `×${match.home.red_cards}` : ""}</span>
          )}
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className="score-pill score-pill--live">{match.home?.score} – {match.away?.score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__team match-row__team--away">
          {match.away?.red_cards > 0 && (
            <span className="red-card-badge">🟥{match.away.red_cards > 1 ? `×${match.away.red_cards}` : ""}</span>
          )}
          <span className="team-name">{match.away?.name}</span>
          {match.away?.logo && (
            <img src={match.away.logo} alt={match.away.name} className="flag-xs" loading="eager"
              onError={e => (e.target.style.display = "none")} />
          )}
        </div>
      </div>
      <div className="match-row__meta">
        {match.venue && <span style={{ fontSize: "0.65rem", color: "#666" }}>{match.venue}</span>}
      </div>
    </div>
  )
}

function CompetitionBlock({ leagueName, leagueLogo, leagueCountry, matches, onMatchClick }) {
  const { i18n } = useTranslation()
  const sorted = [...matches].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))

  return (
    <div className="widget-next-match mb-4">
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        {leagueLogo && (
          <img src={leagueLogo} alt="" className="logo-sm" loading="eager"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{translateLeague(leagueName, i18n.language) ?? "Live"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{leagueCountry}</span>
        <span className="live-badge">LIVE</span>
      </div>
      <div className="widget-body p-0">
        {sorted.map((m, i) => <LiveMatchRow key={m.external_id ?? i} match={m} onMatchClick={onMatchClick} />)}
      </div>
    </div>
  )
}

export default function LivePage() {
  usePageMeta("Live Scores", "All live football matches right now — scores, goals and minute-by-minute updates.")
  const { t } = useTranslation()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const navigate = useNavigate()
  const onMatchClick = (match) => navigateToMatch(navigate, match)

  const load = () =>
    fetchWithTimeout("/api/v1/live_scores")
      .then(r => r.json())
      .then(data => {
        setMatches(data)
        setLastUpdated(new Date())
        setError(false)
      })
      .catch(() => setError(true))

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  // Refresh every 30s, but only while the tab is visible.
  useVisiblePolling(load, 30000)

  const byLeague = matches.reduce((acc, m) => {
    const key = m.league_id ?? m.league_name ?? "other"
    if (!acc[key]) acc[key] = { leagueName: m.league_name, leagueLogo: m.league_logo, leagueCountry: m.league_country, matches: [] }
    acc[key].matches.push(m)
    return acc
  }, {})

  const groups = Object.values(byLeague).sort((a, b) =>
    (a.leagueName ?? "").localeCompare(b.leagueName ?? "")
  )

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
          <p style={{ color: "#888", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
          <button className="btn btn-primary btn-sm" onClick={() => { setError(false); setLoading(true); load().finally(() => setLoading(false)) }}>
            {t("error.retry")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="live-dot" />
            <span style={{ fontWeight: 600 }}>{t("live.matchesLive", { count: matches.length })}</span>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: "0.72rem", color: "#666" }}>
              {t("live.updated")} {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              <span style={{ marginLeft: 6, color: "#555" }}>· {t("live.refreshes")}</span>
            </span>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__pitch" /><div className="empty-state__icon">⚽</div>
            <h3>{t("scores.noLive")}</h3>
            <p>{t("live.checkBack")}</p>
          </div>
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
