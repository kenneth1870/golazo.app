import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../../hooks/usePageMeta"

const COUNTRY_FLAG = { "USA": "🇺🇸", "Canada": "🇨🇦", "Mexico": "🇲🇽" }
const RESULT_COLOR = { W: "#10b981", D: "#f59e0b", L: "#ef4444" }

function fmtKickoff(utc) {
  if (!utc) return ""
  return new Date(utc).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function VenueMatchRow({ match, navigate }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  return (
    <div
      className={`match-row${match.external_id ? " match-row--clickable" : ""}`}
      onClick={() => match.external_id && navigate(`/matches/${match.external_id}`)}
      style={{ cursor: match.external_id ? "pointer" : "default", fontSize: "0.82rem" }}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />LIVE</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">{fmtKickoff(match.kickoff_at)}</span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display = "none")} />}
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
          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display = "none")} />}
        </div>
      </div>
      <div className="match-row__meta">
        <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{match.round || (match.group_stage ? `Group ${match.group_stage}` : "")}</span>
      </div>
    </div>
  )
}

export default function VenuesPage() {
  const { t } = useTranslation()
  usePageMeta(t("mundial.venuesTitle"), "FIFA World Cup 2026 stadiums — 16 official venues across USA, Canada and Mexico.")
  const navigate = useNavigate()
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    fetch("/api/v1/venues")
      .then(r => r.json())
      .then(setVenues)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  const byCountry = venues.reduce((acc, v) => {
    if (!acc[v.country]) acc[v.country] = []
    acc[v.country].push(v)
    return acc
  }, {})

  const toggle = (name) => setExpanded(e => ({ ...e, [name]: !e[name] }))

  return (
    <div className="site-section">
      <div className="container">
        {Object.entries(byCountry).map(([country, countryVenues]) => (
          <div key={country} className="mb-5">
            <div className="title-section">
              <h2 className="heading">{COUNTRY_FLAG[country]} {country}</h2>
            </div>
            <div className="row">
              {countryVenues.map((v, i) => (
                <div key={i} className="col-lg-6 mb-4">
                  <div className="venue-card" style={{ cursor: v.matches?.length ? "pointer" : "default" }} onClick={() => v.matches?.length && toggle(v.name)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div className="venue-card__name">{v.name}</div>
                        <div className="venue-card__city">{v.city}</div>
                      </div>
                      {v.matches?.length > 0 && (
                        <span style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 700 }}>
                          {v.matches.length} matches {expanded[v.name] ? "▴" : "▾"}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                      <div className="venue-card__capacity">
                        <span className="venue-card__capacity-label">{t("mundial.capacity")}</span>
                        <span className="venue-card__capacity-value">{v.capacity?.toLocaleString()}</span>
                      </div>
                      {v.group && <div className="venue-card__note" style={{ alignSelf: "center" }}>{v.group}</div>}
                    </div>
                  </div>

                  {expanded[v.name] && v.matches?.length > 0 && (
                    <div className="match-section" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                      {v.matches.map(m => (
                        <VenueMatchRow key={m.id} match={m} navigate={navigate} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
