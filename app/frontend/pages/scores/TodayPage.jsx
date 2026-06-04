import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import MatchRow from "../../components/MatchRow"

function normalizeReal(m) {
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
      code:    null,
    },
    round: null,
  }
}

function RealMatchRow({ match, onMatchClick }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null
  const clickable  = !!match.external_id

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : ""

  return (
    <div
      className={`match-row${isLive ? " match-row--live" : ""}${clickable ? " match-row--clickable" : ""}`}
      onClick={clickable ? () => onMatchClick(match.external_id) : undefined}
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
        {clickable && <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>›</span>}
      </div>
    </div>
  )
}

function CompetitionBlock({ competition, matches, isReal, navigate, onMatchClick }) {
  const hasLive = matches.some(m => m.status === "live")
  const sorted  = [...matches].sort((a, b) => {
    const order = { live: 0, scheduled: 1, finished: 2 }
    return (order[a.status] ?? 3) - (order[b.status] ?? 3) || new Date(a.kickoff_at) - new Date(b.kickoff_at)
  })

  const comp = competition || matches[0]?.competition
  const canNav = comp?.code && !comp.code.startsWith("ext-")

  return (
    <div className="widget-next-match mb-4">
      <div
        className={`widget-title d-flex align-items-center${canNav ? " cursor-pointer" : ""}`}
        style={{ gap: 10, cursor: canNav ? "pointer" : "default" }}
        onClick={canNav ? () => navigate(`/leagues/${comp.code}`) : undefined}
      >
        {comp?.logo && (
          <img src={comp.logo} alt="" className="logo-sm"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{comp?.name ?? "Other"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{comp?.country}</span>
        {hasLive && <span className="live-badge">LIVE</span>}
        {canNav && <span style={{ fontSize: "0.75rem", color: "#ee1e46" }}>→</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m =>
          isReal
            ? <RealMatchRow key={m.id} match={m} onMatchClick={onMatchClick} />
            : <MatchRow key={m.id} match={m} onClick={m.external_id ? () => onMatchClick(m.external_id) : undefined} />
        )}
      </div>
    </div>
  )
}

function TodayEmptyState() {
  const [nextDate, setNextDate] = useState(null)

  useEffect(() => {
    // Check tomorrow then the day after to find the next match day
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const iso = tomorrow.toISOString().split("T")[0]
    fetch(`/api/v1/fixtures?date=${iso}`)
      .then(r => r.json())
      .then(matches => {
        if (matches.length > 0 && matches[0].kickoff_at) {
          setNextDate(new Date(matches[0].kickoff_at))
        }
      })
      .catch(() => {})
  }, [])

  const label = nextDate
    ? nextDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : null

  return (
    <div className="empty-state">
      <div className="empty-state__pitch" />
      <div className="empty-state__icon">📅</div>
      <h3>No matches today</h3>
      <p>
        {label
          ? <>Next matches on <strong style={{ color: "#fff" }}>{label}</strong></>
          : "Check the Fixtures tab for upcoming matches"}
      </p>
    </div>
  )
}

export default function TodayPage() {
  const [data, setData]       = useState({ real: [], local: [] })
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  const load = () =>
    fetch("/api/v1/today")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})

  useEffect(() => {
    load().finally(() => setLoading(false))
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const realNorm  = (data.real || []).map(normalizeReal)
  const dbMatches = data.local || []

  const dbByComp = dbMatches.reduce((acc, m) => {
    const key = m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const realByLeague = realNorm.reduce((acc, m) => {
    const key = m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const liveCount  = [...realNorm, ...dbMatches].filter(m => m.status === "live").length
  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })

  const sortGroups = (groups, isReal) =>
    Object.values(groups)
      .sort((a, b) => {
        const aLive = a.some(m => m.status === "live") ? 0 : 1
        const bLive = b.some(m => m.status === "live") ? 0 : 1
        return aLive - bLive || (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
      })
      .map(matches => ({ matches, isReal }))

  const allGroups = [
    ...sortGroups(realByLeague, true),
    ...sortGroups(dbByComp, false),
  ]

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
    <div className="site-section">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ color: "#aaa", fontSize: "0.85rem" }}>{todayLabel}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: "0.8rem" }}>
            {liveCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#ee1e46" }}>
                <span className="live-dot" />
                {liveCount} live now
              </span>
            )}
            <span style={{ color: "#555", fontSize: "0.72rem" }}>
              {realNorm.length} real · {dbMatches.length} scheduled
            </span>
          </div>
        </div>

        {allGroups.length === 0 ? (
          <TodayEmptyState />
        ) : (
          allGroups.map(({ matches, isReal }, i) => (
            <CompetitionBlock
              key={`${isReal ? "real" : "db"}-${matches[0]?.competition?.id ?? i}`}
              competition={matches[0]?.competition}
              matches={matches}
              isReal={isReal}
              navigate={navigate}
              onMatchClick={onMatchClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
