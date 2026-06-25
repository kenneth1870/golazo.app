import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../i18n/leagueNames"
import { translateTeam } from "../i18n/teamNames"

function formatKickoff(utcDate, locale) {
  return new Date(utcDate).toLocaleTimeString(locale || undefined, {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short"
  })
}

function MatchRow({ match, onClick }) {
  const { t, i18n } = useTranslation()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  return (
    <div
      className={`d-flex align-items-center py-3 px-3${isLive ? " live-row" : ""}`}
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s",
        borderLeft: isLive ? "3px solid #ee1e46" : "3px solid transparent",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {/* Status / time */}
      <div style={{ width: 70, flexShrink: 0, textAlign: "center" }}>
        {isLive ? (
          <span style={{ color: "#ee1e46", fontSize: "0.7rem", fontWeight: 700, letterSpacing: 1 }}>
            <span className="live-indicator" /> {match.minute || t("status.live")}
          </span>
        ) : isFinished ? (
          <span style={{ color: "gray", fontSize: "0.72rem" }}>{t("status.ft")}</span>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
            {formatKickoff(match.kickoff_at, i18n.language)}
          </span>
        )}
      </div>

      {/* Home team */}
      <div className="d-flex align-items-center" style={{ flex: 1, justifyContent: "flex-end", gap: 8 }}>
        <span style={{ color: "var(--text)", fontWeight: 600, fontSize: "0.9rem" }}>{translateTeam(match.home_team?.name, i18n.language) || match.home_team?.name}</span>
        {match.home_team?.flag_url && (
          <img src={match.home_team.flag_url} alt={match.home_team.name} className="flag-xs" loading="eager" />
        )}
      </div>

      {/* Score */}
      <div style={{ width: 72, textAlign: "center", flexShrink: 0 }}>
        {hasScore ? (
          <span style={{
            fontWeight: 900, fontSize: "1.05rem",
            color: isLive ? "#ee1e46" : "var(--text)",
            background: "var(--surface2)",
            padding: "3px 10px", borderRadius: 4
          }}>
            {match.home_score} – {match.away_score}
          </span>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>vs</span>
        )}
      </div>

      {/* Away team */}
      <div className="d-flex align-items-center" style={{ flex: 1, gap: 8 }}>
        {match.away_team?.flag_url && (
          <img src={match.away_team.flag_url} alt={match.away_team.name} className="flag-xs" loading="eager" />
        )}
        <span style={{ color: "var(--text)", fontWeight: 600, fontSize: "0.9rem" }}>{translateTeam(match.away_team?.name, i18n.language) || match.away_team?.name}</span>
      </div>

      {/* Round */}
      <div style={{ width: 110, flexShrink: 0, textAlign: "right" }}>
        <span style={{ color: "gray", fontSize: "0.72rem" }}>{match.round || match.group_stage}</span>
      </div>
    </div>
  )
}

function CompetitionGroup({ competition, matches, onMatchSelect }) {
  const { t, i18n } = useTranslation()
  const liveCount = matches.filter(m => m.status === "live").length

  return (
    <div className="widget-next-match mb-4">
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        {competition.logo && (
          <img src={competition.logo} alt="" className="logo-sm" loading="eager" />
        )}
        <h3 style={{ margin: 0 }}>{translateLeague(competition.name, i18n.language)}</h3>
        {competition.country && (
          <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: "auto" }}>
            {competition.country}
          </span>
        )}
        {liveCount > 0 && (
          <span style={{
            background: "#ee1e46", color: "#fff", fontSize: "0.65rem",
            fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: 1
          }}>
            {t("status.liveCount", { count: liveCount })}
          </span>
        )}
      </div>
      <div className="widget-body" style={{ padding: 0 }}>
        {matches.map(m => (
          <MatchRow key={m.id} match={m} onClick={() => onMatchSelect(m.id)} />
        ))}
      </div>
    </div>
  )
}

export default function TodayMatches({ onMatchSelect }) {
  const { t, i18n } = useTranslation()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const fetch_ = () => {
      if (document.hidden) return
      fetch(`/api/v1/today?tz=${encodeURIComponent(tz)}`)
        .then(r => r.json())
        .then(matches => {
          // Group by competition
          const grouped = matches.reduce((acc, m) => {
            const comp = m.competition || { id: 0, name: "Other", code: "?", logo: null, country: null }
            const key  = comp.code || comp.id
            if (!acc[key]) acc[key] = { competition: comp, matches: [] }
            acc[key].matches.push(m)
            return acc
          }, {})
          setData(Object.values(grouped))
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
    const onVisible = () => { if (!document.hidden) fetch_() }
    fetch_()
    document.addEventListener("visibilitychange", onVisible)
    const iv = setInterval(() => { if (!document.hidden) fetch_() }, 30000)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  if (loading) return (
    <div className="site-section">
      <div className="container">
        <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />
      </div>
    </div>
  )

  const today = new Date().toLocaleDateString(i18n.language || undefined, { weekday: "long", month: "long", day: "numeric" })

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          <div className="col-12 title-section">
            <h2 className="heading">{t("time.today")} — {today}</h2>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="widget-next-match">
            <div className="widget-body text-center py-5">
              <p style={{ color: "gray" }}>{t("scores.noMatchesToday")}</p>
            </div>
          </div>
        ) : (
          data.map(({ competition, matches }) => (
            <CompetitionGroup
              key={competition.code}
              competition={competition}
              matches={matches}
              onMatchSelect={onMatchSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
