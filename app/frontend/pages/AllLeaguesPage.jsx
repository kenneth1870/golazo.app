import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"

const TYPE_ORDER = { world_cup: 0, cup: 1, league: 2 }
const TYPE_LABEL = { world_cup: "World Cup", cup: "Cups & International", league: "Domestic Leagues" }

function LeagueCard({ competition, liveCount, onClick }) {
  return (
    <div className="league-card" onClick={onClick} style={{ cursor: "pointer" }}>
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
        <div className="league-card__name">{competition.name}</div>
        <div className="league-card__country">{competition.country}</div>
      </div>
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
  const { t } = useTranslation()
  usePageMeta(t("leagues.title"), "Live football leagues and competitions worldwide — scores, standings and fixtures.")
  const [competitions, setCompetitions] = useState([])
  const [liveMatches, setLiveMatches]   = useState([])
  const [loading, setLoading]           = useState(true)
  const navigate = useNavigate()

  const loadLive = () =>
    fetch("/api/v1/live_scores")
      .then(r => r.json())
      .then(setLiveMatches)
      .catch(() => {})

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/competitions").then(r => r.json()),
      loadLive()
    ]).then(([comps]) => {
      setCompetitions(comps)
    }).finally(() => setLoading(false))

    const iv = setInterval(loadLive, 30000)
    return () => clearInterval(iv)
  }, [])

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

  // Group competitions by type
  const byType = competitions.reduce((acc, c) => {
    const type = c.competition_type || "league"
    if (!acc[type]) acc[type] = []
    acc[type].push(c)
    return acc
  }, {})

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

  return (
    <>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("leagues.title")}</h1>
          <p className="page-hero__sub">
            {totalLive > 0
              ? t("leagues.subtitle", { count: totalLive, comps: competitions.length })
              : `${competitions.length} competitions`}
          </p>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {/* Live worldwide banner */}
          {totalLive > 0 && (
            <div
              className="widget-next-match mb-5"
              style={{ borderLeft: "3px solid #ee1e46", cursor: "pointer" }}
              onClick={() => navigate("/scores/live")}
            >
              <div className="widget-title d-flex align-items-center" style={{ gap: 8 }}>
                <span className="live-dot" />
                <h3 style={{ margin: 0 }}>{t("leagues.subtitle", { count: totalLive, comps: competitions.length })}</h3>
                <span style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#ee1e46" }}>
                  {t("home.viewAll")}
                </span>
              </div>
            </div>
          )}

          {/* Competitions grouped by type */}
          {sortedTypes.map(type => (
            <div key={type} className="mb-5">
              <div className="title-section">
                <h2 className="heading">{TYPE_LABEL[type] ?? type}</h2>
              </div>
              <div className="leagues-grid">
                {byType[type].map(c => (
                  <LeagueCard
                    key={c.id}
                    competition={c}
                    liveCount={liveByCode[c.code] ?? 0}
                    onClick={() => navigate(c.code === "WC" ? "/mundial" : `/leagues/${c.code}`)}
                  />
                ))}
              </div>
            </div>
          ))}

          {competitions.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">🌍</div>
              <h3>{t("leagues.available", { count: 0 })}</h3>
              <p>{t("leagues.checkBack")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
