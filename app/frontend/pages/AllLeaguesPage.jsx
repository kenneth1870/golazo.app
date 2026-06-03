import { useState, useEffect } from "react"
import { formatKickoff } from "../hooks/useLocalTime"

function LiveMatchRow({ match }) {
  const isLive = match.started && !match.finished
  return (
    <div className={`match-row${isLive ? " match-row--live" : ""}`}>
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute}</span>
          : match.finished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">—</span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          <span className="team-name">{match.home?.name}</span>
        </div>
        <div className="match-row__score">
          <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>
            {match.home?.score} – {match.away?.score}
          </span>
        </div>
        <div className="match-row__team match-row__team--away">
          <span className="team-name">{match.away?.name}</span>
          {match.away?.red_cards > 0 && <span className="red-card-badge">🟥</span>}
        </div>
      </div>
      <div className="match-row__meta" />
    </div>
  )
}

export default function AllLeaguesPage() {
  const [live, setLive]       = useState([])
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/live_scores").then(r => r.json()),
      fetch("/api/v1/all_leagues").then(r => r.json())
    ]).then(([liveData, leagueData]) => {
      setLive(liveData)
      setLeagues(leagueData)
    }).finally(() => setLoading(false))

    const iv = setInterval(() => {
      fetch("/api/v1/live_scores").then(r => r.json()).then(setLive).catch(() => {})
    }, 30000)
    return () => clearInterval(iv)
  }, [])

  const leagueMap = leagues.reduce((acc, l) => { acc[l.id] = l; return acc }, {})

  // Group live by league
  const byLeague = live.reduce((acc, m) => {
    const lid = m.league_id
    if (!acc[lid]) acc[lid] = []
    acc[lid].push(m)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">All Leagues</h1>
          <p className="page-hero__sub">{live.length} matches live right now across {Object.keys(byLeague).length} competitions</p>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {live.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">🌍</div>
              <h3>No live matches worldwide right now</h3>
              <p>Check back during match times</p>
              <div className="title-section mt-5"><h2 className="heading">Available Leagues ({leagues.length})</h2></div>
              <div className="leagues-grid">
                {leagues.map(l => (
                  <div key={l.id} className="league-chip">
                    {l.logo && <img src={l.logo} alt="" onError={e => e.target.style.display='none'} />}
                    <span>{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            Object.entries(byLeague).map(([leagueId, matches]) => {
              const league = leagueMap[parseInt(leagueId)]
              return (
                <div key={leagueId} className="widget-next-match mb-4">
                  <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
                    {league?.logo && <img src={league.logo} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} onError={e => e.target.style.display='none'} />}
                    <h3 style={{ margin: 0 }}>{league?.name || `League ${leagueId}`}</h3>
                    <span className="live-badge ml-auto">{matches.length} LIVE</span>
                  </div>
                  <div className="widget-body p-0">
                    {matches.map((m, i) => <LiveMatchRow key={i} match={m} />)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
