import { useState, useEffect, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { usePageMeta } from "../../hooks/usePageMeta"
import { navigateToMatch, navIdFor } from "../../utils/matchDetailCache"
import { useStandingsChannel } from "../../hooks/useStandingsChannel"
import { useVisiblePolling } from "../../hooks/useVisiblePolling"
import { GroupStandingsCompact, BestThirdsView } from "../../components/GroupStandingsView"
import OfflineBanner from "../../components/OfflineBanner"
import { fetchJson } from "../../utils/fetchJson"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

function MiniStandingsTable({ group, rows }) {
  const { t, i18n } = useTranslation()
  if (!rows?.length) return null
  return <GroupStandingsCompact rows={rows} t={t} lang={i18n.language} />
}

function BestThirdsTable({ rows }) {
  const { t, i18n } = useTranslation()
  return <BestThirdsView rows={rows} t={t} lang={i18n.language} />
}

export default function GroupStagePage() {
  const { t } = useTranslation()
  usePageMeta(t("nav.groupStage"), "FIFA World Cup 2026 group stage matches — all 72 group fixtures across 12 groups.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const [standings, setStandings] = useState({})
  const [bestThirds, setBestThirds] = useState([])
  const [standingsError, setStandingsError] = useState(false)
  const [stale, setStale]                   = useState(false)

  const hasLiveOrRecent = matches.some(m =>
    m.status === "live" ||
    (m.status === "finished" && m.kickoff_at && new Date() - new Date(m.kickoff_at) < 3 * 60 * 60 * 1000)
  )

  const loadStandings = useCallback(() => {
    setStandingsError(false)
    setStale(false)
    return fetchJson("/api/v1/standings?competition=WC")
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) throw new Error()
        setStandings(data || {})
      })
      .catch(() => { setStandings({}); setStandingsError(true) })
  }, [])

  const loadBestThirds = () => fetchJson("/api/v1/standings/best_thirds")
    .then(({ data, ok }) => { if (ok && Array.isArray(data)) setBestThirds(data) })
    .catch(() => {})

  useEffect(() => {
    loadStandings()
    loadBestThirds()
  }, [hasLiveOrRecent])

  // Refresh standings on an interval (30s with live/recent matches, 60s
  // otherwise), paused while the tab is hidden.
  useVisiblePolling(() => { loadStandings(); loadBestThirds() }, hasLiveOrRecent ? 30_000 : 60_000)

  useStandingsChannel(loadStandings)

  const groupMatches = matches.filter(m => m.group_stage)
  const byGroup = GROUPS.reduce((acc, g) => {
    acc[g] = groupMatches.filter(m => m.group_stage === g)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        <OfflineBanner stale={stale} onRetry={loadStandings} />
        {standingsError && (
          <div style={{ textAlign: "center", padding: "16px", marginBottom: 20, background: "var(--surface)", borderRadius: 8 }}>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 12 }}>{t("error.failedToLoad")}</p>
            <button className="btn btn-sm btn-outline-light" onClick={loadStandings}>{t("error.retry")}</button>
          </div>
        )}
        <div className="row">
          {GROUPS.filter(g => byGroup[g].length > 0).map(g => (
            <div key={g} className="col-lg-6 mb-5">
              <div className="group-matches-card">
                <div className="group-matches-card__header">
                  <span>{t("nav.group", { letter: g })}</span>
                  <Link to={`/groups/${g}`} className="group-link" style={{ textDecoration: "none" }}>
                    {t("groups.viewStandings")}
                  </Link>
                </div>

                {/* Mini standings table */}
                {!standingsError && <MiniStandingsTable group={g} rows={standings[g]} />}

                {/* Matches */}
                <div className="match-list match-list--compact" style={{ marginTop: 10 }}>
                  {byGroup[g].map(m => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      showDate
                      showMeta={false}
                      onClick={() => navIdFor(m) ? navigateToMatch(navigate, m) : navigate(`/groups/${g}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Best Third-placed Teams */}
        {bestThirds.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div style={{
              fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 12,
            }}>
              {t("table.bestThirds", "Mejores Terceros")}
            </div>
            <div className="group-matches-card" style={{ padding: "12px 16px" }}>
              <BestThirdsTable rows={bestThirds} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
