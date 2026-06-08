import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { useFavorites } from "../hooks/useFavorites"

export default function TeamShowPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [team, setTeam]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [standing, setStanding] = useState(null)
  usePageMeta(
    team ? `${team.name} — World Cup 2026` : null,
    team ? `${team.name} FIFA World Cup 2026 fixtures, results and group standings.` : null
  )

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
      <div>
        <div className="match-back-bar">
          <div className="container" style={{ maxWidth: 700 }}>
            <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← Back</button>
          </div>
        </div>
        <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)", padding: "48px 0 32px", borderBottom: "1px solid var(--border)" }}>
          <div className="container" style={{ maxWidth: 700 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div className="loading-shimmer" style={{ width: 72, height: 72, borderRadius: 8, flexShrink: 0 }} />
              <div>
                <div className="loading-shimmer" style={{ width: 180, height: 22, borderRadius: 6, marginBottom: 8 }} />
                <div className="loading-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
              </div>
            </div>
          </div>
        </div>
        <div className="container" style={{ maxWidth: 700, paddingTop: 24 }}>
          {[3, 2, 3].map((rows, bi) => (
            <div key={bi} className="widget-next-match mb-4">
              <div className="widget-title"><div className="loading-shimmer" style={{ width: 120, height: 14, borderRadius: 4 }} /></div>
              <div className="widget-body p-0">
                {Array.from({ length: rows }).map((_, i) => (
                  <div key={i} className="match-row">
                    <div className="loading-shimmer" style={{ width: 36, height: 12, borderRadius: 3 }} />
                    <div style={{ flex: 1 }}><div className="loading-shimmer" style={{ width: "55%", height: 12, borderRadius: 3 }} /></div>
                    <div className="loading-shimmer" style={{ width: 40, height: 20, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
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
            <h3>{t("error.notFound")}</h3>
            <p><Link to="/mundial/teams" style={{ color: "var(--accent)" }}>← {t("nav.teams")}</Link></p>
          </div>
        </div>
      </div>
    )
  }

  const matches   = team.matches || []
  const upcoming  = matches.filter(m => m.status === "scheduled").sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
  const finished  = matches.filter(m => m.status === "finished").sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))
  const live      = matches.filter(m => m.status === "live")

  // Last 5 finished results as W/D/L
  const form = finished.slice(0, 5).reverse().map(m => {
    const isHome   = m.home_team?.name === team.name
    const myScore  = isHome ? m.home_score : m.away_score
    const oppScore = isHome ? m.away_score : m.home_score
    if (myScore > oppScore)  return "W"
    if (myScore === oppScore) return "D"
    return "L"
  })

  return (
    <div>
      {/* Back bar */}
      <div className="match-back-bar">
        <div className="container" style={{ maxWidth: 700, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back", "Back")}</button>
          {team && (
            <button
              onClick={() => toggleFavorite({ type: "team", id: team.id, name: team.name, flag_url: team.flag_url, group: team.group })}
              title={isFavorite("team", team.id) ? "Unfollow team" : "Follow team"}
              style={{
                background: isFavorite("team", team.id) ? "rgba(238,30,70,.15)" : "rgba(255,255,255,.06)",
                border: isFavorite("team", team.id) ? "1px solid rgba(238,30,70,.4)" : "1px solid rgba(255,255,255,.12)",
                borderRadius: 20, padding: "5px 14px", color: isFavorite("team", team.id) ? "#ee1e46" : "rgba(255,255,255,.4)",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", transition: ".2s",
              }}
            >
              {isFavorite("team", team.id) ? "★ Following" : "☆ Follow"}
            </button>
          )}
        </div>
      </div>

      {/* Team hero */}
      <div style={{ background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)", borderBottom: "1px solid var(--border)", padding: "32px 0 32px" }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {team.flag_url && (
              <img src={team.flag_url} alt={team.name} className="logo-lg"
                onError={e => (e.target.style.display = "none")} />
            )}
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: "1.8rem", fontWeight: 900, color: "#fff" }}>{team.name}</h1>
              {team.code && <div style={{ fontSize: "0.8rem", color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase" }}>{team.code}</div>}
              {team.group && <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#ee1e46", fontWeight: 700 }}>{t("nav.group", { letter: team.group })}</div>}
            </div>
          </div>

          {/* Standing summary */}
          {standing && (
            <div style={{ display: "flex", gap: 20, marginTop: 24, flexWrap: "wrap" }}>
              {[
                [t("table.pos"),    standing.rank ?? "–"],
                [t("table.played"), standing.played ?? 0],
                [t("table.won"),    standing.won ?? 0],
                [t("table.drawn"),  standing.drawn ?? 0],
                [t("table.lost"),   standing.lost ?? 0],
                [t("table.gd"),     (standing.goal_diff ?? 0) > 0 ? `+${standing.goal_diff}` : standing.goal_diff ?? 0],
                [t("table.points"), standing.points ?? 0],
              ].map(([label, val]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff" }}>{val}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Form guide */}
          {form.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".1em", marginRight: 4 }}>{t("scores.form", "Form")}</span>
              {form.map((r, i) => (
                <span key={i} style={{
                  width: 26, height: 26, borderRadius: "50%", display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 800, color: "#fff",
                  background: r === "W" ? "#10b981" : r === "D" ? "#f59e0b" : "#ef4444",
                }}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ maxWidth: 700, paddingTop: 16 }}>

        {/* Live match */}
        {live.length > 0 && (
          <section className="match-section" style={{ borderColor: "rgba(238,30,70,.4)" }}>
            <h3 className="match-section__title" style={{ color: "#ee1e46" }}>{t("home.playingNow")}</h3>
            {live.map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="match-section">
            <h3 className="match-section__title">{t("scores.upcomingFixtures")}</h3>
            {upcoming.slice(0, 6).map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {/* Results */}
        {finished.length > 0 && (
          <section className="match-section">
            <h3 className="match-section__title">{t("nav.results")}</h3>
            {finished.slice(0, 6).map(m => <MatchLine key={m.id} match={m} teamName={team.name} navigate={navigate} />)}
          </section>
        )}

        {matches.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state__icon">📅</div>
            <h3>{t("noMatches")}</h3>
            <p>{t("scores.noFixtures")}</p>
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
