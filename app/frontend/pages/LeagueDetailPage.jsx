import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import MatchRow from "../components/MatchRow"
import { useFavorites } from "../hooks/useFavorites"

// Inline tabs — no nested routing needed for this page
const TABS = ["Today", "Fixtures", "Results"]

function StandingsTable({ standings }) {
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
            <div className="fixture-day__header">Group {group}</div>
          )}
          <div className="table-responsive">
            <table className="table custom-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>Pts</th>
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
                        <strong className="text-white">{s.team?.name}</strong>
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
  const { code } = useParams()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [competition, setCompetition] = useState(null)
  const [matches, setMatches]         = useState([])
  const [standings, setStandings]     = useState([])
  const [tab, setTab]                 = useState("Today")
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/v1/competitions/${code}`).then(r => r.json()),
      fetch(`/api/v1/matches?competition=${code}`).then(r => r.json()),
      fetch(`/api/v1/standings?competition=${code}`).then(r => r.json()).catch(() => []),
    ]).then(([comp, matchData, standData]) => {
      setCompetition(comp)
      setMatches(Array.isArray(matchData) ? matchData : [])
      setStandings(Array.isArray(standData) ? standData : [])
    }).finally(() => setLoading(false))
  }, [code])

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

  const displayedMatches =
    tab === "Today"    ? [...liveMatches, ...todayMatches.filter(m => m.status !== "live")] :
    tab === "Fixtures" ? upcoming :
                         results

  if (loading) {
    return (
      <div>
        <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
          <div className="container"><h1 className="page-hero__title">Loading...</h1></div>
        </div>
        <div className="site-section container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
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
                  background: isFavorite("competition", competition.id ?? code) ? "rgba(238,30,70,.15)" : "rgba(255,255,255,.1)",
                  border: isFavorite("competition", competition.id ?? code) ? "1px solid rgba(238,30,70,.4)" : "1px solid rgba(255,255,255,.2)",
                  borderRadius: 20, padding: "6px 16px",
                  color: isFavorite("competition", competition.id ?? code) ? "#ee1e46" : "rgba(255,255,255,.6)",
                  fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                {isFavorite("competition", competition.id ?? code) ? "★ Following" : "☆ Follow"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner">
            {TABS.map(t => (
              <button
                key={t}
                className={`tab-link${tab === t ? " tab-link--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "Today" && liveMatches.length > 0 && (
                  <span className="live-dot" style={{ marginLeft: 6 }} />
                )}
              </button>
            ))}
            {standings.length > 0 && (
              <button
                className={`tab-link${tab === "Standings" ? " tab-link--active" : ""}`}
                onClick={() => setTab("Standings")}
              >
                Standings
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {tab === "Standings" ? (
            <StandingsTable standings={standings} />
          ) : displayedMatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3>No {tab.toLowerCase()} matches</h3>
              <p>
                {tab === "Today" ? "No matches scheduled today for this competition" :
                 tab === "Fixtures" ? "No upcoming fixtures found" :
                 "No results yet"}
              </p>
            </div>
          ) : (
            <div className="match-list">
              {displayedMatches.map(m => (
                <MatchRow key={m.id} match={m} showDate={tab !== "Today"} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
