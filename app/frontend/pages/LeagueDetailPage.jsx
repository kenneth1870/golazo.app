import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import MatchRow from "../components/MatchRow"
import { useFavorites } from "../hooks/useFavorites"
import { usePageMeta } from "../hooks/usePageMeta"

function StandingsTable({ standings, t, i18n }) {
  if (!standings || standings.length === 0) return null

  // Group by group_name if present
  const groups = standings.reduce((acc, s) => {
    const g = s.group_name || "Overall"
    if (!acc[g]) acc[g] = []
    acc[g].push(s)
    return acc
  }, {})

  return (
    <>
      {Object.entries(groups).map(([group, rows]) => (
        <div key={group} className="mb-4">
          {group !== "Overall" && (
            <div className="fixture-day__header">{t("table.group")} {group}</div>
          )}
          <div className="table-responsive">
            <table className="table custom-table">
              <thead>
                <tr>
                  <th>{t("table.pos")}</th>
                  <th>{t("table.team")}</th>
                  <th>{t("table.played")}</th>
                  <th>{t("table.won")}</th>
                  <th>{t("table.drawn")}</th>
                  <th>{t("table.lost")}</th>
                  <th>{t("table.gf")}</th>
                  <th>{t("table.ga")}</th>
                  <th>{t("table.gd")}</th>
                  <th>{t("table.points")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: "#888" }}>{s.rank}</td>
                    <td>
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        {s.team?.flag_url && (
                          <img
                            src={s.team.flag_url}
                            alt=""
                            className="flag-xs"
                            loading="eager"
                            onError={e => (e.target.style.display = "none")}
                          />
                        )}
                        <strong className="text-white">{translateTeam(s.team?.name, i18n.language)}</strong>
                      </div>
                    </td>
                    <td>{s.played}</td>
                    <td>{s.won}</td>
                    <td>{s.drawn}</td>
                    <td>{s.lost}</td>
                    <td>{s.goals_for}</td>
                    <td>{s.goals_against}</td>
                    <td style={{ color: s.goals_for - s.goals_against >= 0 ? "#10b981" : "#ee1e46" }}>
                      {s.goals_for - s.goals_against >= 0 ? "+" : ""}{s.goals_for - s.goals_against}
                    </td>
                    <td><strong className="text-white">{s.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}

export default function LeagueDetailPage() {
  const { t, i18n } = useTranslation()
  const { code } = useParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [competition, setCompetition] = useState(null)
  const [matches, setMatches]         = useState([])
  const [standings, setStandings]     = useState([])
  const [tab, setTab]                 = useState("today")
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/v1/competitions/${code}`).then(r => r.json()),
      fetch(`/api/v1/matches?competition=${code}`).then(r => r.json()),
      fetch(`/api/v1/standings?competition=${code}`).then(r => r.json()).catch(() => []),
    ]).then(([comp, matchData, standData]) => {
      setCompetition(comp)
        const ms = Array.isArray(matchData) ? matchData : []
      setMatches(ms)
      setStandings(Array.isArray(standData) ? standData : [])
      // Auto-select the most relevant tab after data loads
      const now = new Date(); now.setHours(0,0,0,0)
      const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1)
      const hasLiveOrToday = ms.some(m => m.status === "live" || (new Date(m.kickoff_at) >= now && new Date(m.kickoff_at) < tmrw))
      const hasUpcoming    = ms.some(m => m.status === "scheduled" && new Date(m.kickoff_at) >= tmrw)
      const hasResults     = ms.some(m => m.status === "finished")
      if (!hasLiveOrToday && hasUpcoming) setTab("fixtures")
      else if (!hasLiveOrToday && !hasUpcoming && hasResults) setTab("results")
    }).finally(() => setLoading(false))
  }, [code])

  usePageMeta(
    competition ? `${competition.name} Scores & Standings` : null,
    competition
      ? `Live scores, results, fixtures and standings for ${competition.name}${competition.country ? ` — ${competition.country}` : ""}.`
      : null
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayMatches    = matches.filter(m => {
    const d = new Date(m.kickoff_at)
    return d >= today && d < tomorrow
  })
  const upcoming        = matches.filter(m => m.status === "scheduled" && new Date(m.kickoff_at) >= tomorrow)
    .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  const results         = matches.filter(m => m.status === "finished")
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))
  const liveMatches     = matches.filter(m => m.status === "live")

  // Tab definitions (keyed strings for comparison)
  const TABS = [
    { key: "today",      label: t("time.today") },
    { key: "fixtures",   label: t("nav.fixtures") },
    { key: "results",    label: t("nav.results") },
    ...(standings.length > 0 ? [{ key: "standings", label: t("nav.standings", "Standings") }] : []),
  ]

  const displayedMatches =
    tab === "today"    ? [...liveMatches, ...todayMatches.filter(m => m.status !== "live")] :
    tab === "fixtures" ? upcoming :
                         results

  if (loading) {
    return (
      <div>
        <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
          <div className="container"><h1 className="page-hero__title">{t("loading")}</h1></div>
        </div>
        <div className="site-section container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
        <div className="container">
          <div className="d-flex align-items-center" style={{ gap: 16 }}>
            {competition?.logo && (
              <img
                src={competition.logo}
                alt=""
                className="logo-lg" style={{ margin: "0 auto 12px" }}
                onError={e => (e.target.style.display = "none")}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 className="page-hero__title" style={{ marginBottom: 4 }}>{competition?.name}</h1>
              <p className="page-hero__sub" style={{ margin: 0 }}>{competition?.country}</p>
            </div>
            {competition && (
              <button
                onClick={() => toggleFavorite({ type: "competition", id: competition.id ?? code, name: competition.name, code: competition.code ?? code, flag_url: competition.logo })}
                title={isFavorite("competition", competition.id ?? code) ? "Unfollow league" : "Follow league"}
                style={{
                  background: isFavorite("competition", competition.id ?? code) ? "rgba(238,30,70,.15)" : "var(--surface2)",
                  border: isFavorite("competition", competition.id ?? code) ? "1px solid rgba(238,30,70,.4)" : "1px solid var(--border)",
                  borderRadius: 20, padding: "6px 16px",
                  color: isFavorite("competition", competition.id ?? code) ? "#ee1e46" : "var(--muted)",
                  fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                {isFavorite("competition", competition.id ?? code) ? t("team.following") : t("team.follow")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner">
            {TABS.map(tabItem => (
              <button
                key={tabItem.key}
                className={`tab-link${tab === tabItem.key ? " tab-link--active" : ""}`}
                onClick={() => setTab(tabItem.key)}
              >
                {tabItem.label}
                {tabItem.key === "today" && liveMatches.length > 0 && (
                  <span className="live-dot" style={{ marginLeft: 6 }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {tab === "standings" ? (
            <StandingsTable standings={standings} t={t} i18n={i18n} />
          ) : displayedMatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3>{t("noMatches")}</h3>
              <p>
                {tab === "today"    ? t("time.noMatches", { date: t("time.today").toLowerCase() }) :
                 tab === "fixtures" ? t("scores.noFixtures") :
                 t("scores.noResults")}
              </p>
            </div>
          ) : (
            <div className="match-list">
              {displayedMatches.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  showDate={tab !== "today"}
                  onClick={m.external_id ? () => navigate(`/matches/${m.external_id}`) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
