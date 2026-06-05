import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"

export default function TeamShowPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [standing, setStanding] = useState(null)

  useEffect(() => {
    fetch(`/api/v1/teams/${id}`)
      .then(r => r.json())
      .then(data => {
        setTeam(data)
        if (data.group) {
          fetch("/api/v1/standings?competition=WC")
            .then(r => r.json())
            .then(grouped => {
              const rows = grouped[data.group] || []
              setStanding(rows.find(s => s.team?.name === data.name) || null)
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="loading-shimmer" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />
          <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state__icon">⚽</div>
            <h3>Team not found</h3>
            <p><Link to="/mundial/teams" style={{ color: "var(--accent)" }}>← All Teams</Link></p>
          </div>
        </div>
      </div>
    )
  }

  const matches   = team.matches || []
  const upcoming  = matches.filter(m => m.status === "scheduled").sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  const finished  = matches.filter(m => m.status === "finished").sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))
  const live      = matches.filter(m => m.status === "live")

  return (
    <div>
      {/* Team hero */}
      <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)", borderBottom: "1px solid var(--border)", padding: "48px 0 32px" }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 16 }}>
            <Link to="/mundial/teams" style={{ color: "var(--muted)", fontSize: "0.78rem" }}>← All Teams</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {team.flag_url && (
              <img src={team.flag_url} alt={team.name} className="logo-lg"
                onError={e => (e.target.style.display = "none")} />
            )}
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: "1.8rem", fontWeight: 900, color: "#fff" }}>{team.name}</h1>
              {team.code && <div style={{ fontSize: "0.8rem", color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase" }}>{team.code}</div>}
              {team.group && <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#ee1e46", fontWeight: 700 }}>Group {team.group}</div>}
            </div>
          </div>

          {/* Standing summary */}
          {standing && (
            <div style={{ display: "flex", gap: 20, marginTop: 24, flexWrap: "wrap" }}>
              {[
                ["Rank",   standing.rank ?? "–"],
                ["Played", standing.played ?? 0],
                ["Won",    standing.won ?? 0],
                ["Drawn",  standing.drawn ?? 0],
                ["Lost",   standing.lost ?? 0],
                ["GD",     (standing.goal_diff ?? 0) > 0 ? `+${standing.goal_diff}` : standing.goal_diff ?? 0],
                ["Points", standing.points ?? 0],
              ].map(([label, val]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{val}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ maxWidth: 700, paddingTop: 16 }}>

        {/* Live match */}
        {live.length > 0 && (
          <section className="match-section" style={{ borderColor: "rgba(238,30,70,.4)" }}>
            <h3 className="match-section__title" style={{ color: "#ee1e46" }}>Playing Now</h3>
            {live.map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="match-section">
            <h3 className="match-section__title">Upcoming Fixtures</h3>
            {upcoming.slice(0, 6).map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {/* Results */}
        {finished.length > 0 && (
          <section className="match-section">
            <h3 className="match-section__title">Recent Results</h3>
            {finished.slice(0, 6).map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {matches.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state__icon">📅</div>
            <h3>No matches found</h3>
            <p>Fixtures will appear once the schedule is confirmed</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MatchLine({ match, teamName, navigate }) {
  const isHome    = match.home_team?.name === teamName
  const opponent  = isHome ? match.away_team : match.home_team
  const hs = match.home_score
  const as = match.away_score
  const hasScore  = hs !== null && as !== null
  const isLive    = match.status === "live"
  const isFinished = match.status === "finished"

  let result = null
  if (isFinished && hasScore) {
    const myScore  = isHome ? hs : as
    const oppScore = isHome ? as : hs
    result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D"
  }

  const resultColors = { W: "#10b981", D: "#f59e0b", L: "#ef4444" }

  return (
    <div
      className="match-row match-row--clickable"
      onClick={() => match.external_id && navigate(`/matches/${match.external_id}`)}
      style={{ cursor: match.external_id ? "pointer" : "default" }}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">
              {match.kickoff_at ? new Date(match.kickoff_at).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
            </span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {opponent?.flag_url && <img src={opponent.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display="none")} />}
          <span style={{ color: "var(--muted)", fontSize: "0.72rem", marginRight: 6 }}>{isHome ? "H" : "A"}</span>
          <span className="team-name">{opponent?.name}</span>
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{hs} – {as}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__meta">
          {result && (
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: resultColors[result], display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: "#fff" }}>
              {result}
            </span>
          )}
          {match.external_id && <span style={{ fontSize: "0.65rem", color: "var(--muted)", marginLeft: 6 }}>›</span>}
        </div>
      </div>
    </div>
  )
}
