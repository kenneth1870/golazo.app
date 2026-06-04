import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"

function normalizeMatch(m) {
  return {
    id:          `real-${m.external_id}`,
    external_id: m.external_id,
    status:      m.status,
    kickoff_at:  m.kickoff_at,
    minute:      m.minute,
    home_score:  m.home?.score ?? null,
    away_score:  m.away?.score ?? null,
    home_team:   { name: m.home?.name, flag_url: m.home?.logo },
    away_team:   { name: m.away?.name, flag_url: m.away?.logo },
    competition: {
      id:      `ext-${m.league_id}`,
      name:    m.league_name,
      logo:    m.league_logo,
      country: m.league_country,
    },
  }
}

function MatchRow({ match, onMatchClick }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""

  return (
    <div
      className={`match-row${isLive ? " match-row--live" : ""} match-row--clickable`}
      onClick={() => onMatchClick(match.external_id)}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">{kickoffTime}</span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt="" className="flag-xs"
              onError={e => (e.target.style.display = "none")} />
          )}
          <span className="team-name">{match.home_team?.name}</span>
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__team match-row__team--away">
          <span className="team-name">{match.away_team?.name}</span>
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt="" className="flag-xs"
              onError={e => (e.target.style.display = "none")} />
          )}
        </div>
      </div>
      <div className="match-row__meta">
        <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>›</span>
      </div>
    </div>
  )
}

function CompetitionBlock({ matches, onMatchClick }) {
  const comp    = matches[0]?.competition
  const hasLive = matches.some(m => m.status === "live")
  const sorted  = [...matches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

  return (
    <div className="widget-next-match mb-4">
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        {comp?.logo && (
          <img src={comp.logo} alt="" className="logo-sm"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{comp?.name ?? "Other"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{comp?.country}</span>
        {hasLive && <span className="live-badge">LIVE</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m => <MatchRow key={m.id} match={m} onMatchClick={onMatchClick} />)}
      </div>
    </div>
  )
}

function toISO(date) {
  return date.toISOString().split("T")[0]
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatLabel(date) {
  const today    = toISO(new Date())
  const tomorrow = toISO(addDays(new Date(), 1))
  const iso      = toISO(date)
  if (iso === today)    return "Today"
  if (iso === tomorrow) return "Tomorrow"
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
}

export default function FixturesPage() {
  const [date, setDate]       = useState(() => addDays(new Date(), 1))
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  const load = useCallback((d) => {
    setLoading(true)
    fetch(`/api/v1/fixtures?date=${toISO(d)}`)
      .then(r => r.json())
      .then(data => setMatches(data.map(normalizeMatch)))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(date) }, [date, load])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return
      if (e.key === "ArrowLeft")  setDate(d => addDays(d, -1))
      if (e.key === "ArrowRight") setDate(d => addDays(d,  1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const byLeague = matches.reduce((acc, m) => {
    const key = m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const groups = Object.values(byLeague).sort((a, b) =>
    (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
  )

  return (
    <div className="site-section">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ gap: 12 }}>
          <button className="btn-nav" onClick={() => setDate(d => addDays(d, -1))}>← Prev</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>{formatLabel(date)}</div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>{toISO(date)}</div>
          </div>
          <button className="btn-nav" onClick={() => setDate(d => addDays(d, 1))}>Next →</button>
        </div>

        {loading ? (
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__pitch" /><div className="empty-state__icon">📅</div>
            <h3>No fixtures for {formatLabel(date)}</h3>
            <p>Try a different date</p>
          </div>
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock key={g[0]?.competition?.id ?? i} matches={g} onMatchClick={onMatchClick} />
          ))
        )}
      </div>
    </div>
  )
}
