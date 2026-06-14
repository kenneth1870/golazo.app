import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import { useMatch } from "../hooks/useMatches"
import { useMatchChannel } from "../hooks/useMatchChannel"
import LiveStats from "./LiveStats"

export default function MatchDetail({ matchId, onBack }) {
  const { t, i18n } = useTranslation()
  const { match, loading, setMatch } = useMatch(matchId)

  const handleMessage = useCallback((data) => {
    setMatch(prev => {
      if (!prev) return prev
      if (data.type === "score_update")
        return { ...prev, home_score: data.home_score, away_score: data.away_score, status: data.status }
      if (data.type === "goal")
        return { ...prev, goals: [...(prev.goals || []), data.goal], home_score: data.home_score, away_score: data.away_score }
      if (data.type === "stats_update")
        return { ...prev, match_stats: data.stats }
      return prev
    })
  }, [setMatch])

  useMatchChannel(matchId, handleMessage)

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <p className="text-center" style={{ color: "gray", padding: "3rem 0" }}>Loading match...</p>
        </div>
      </div>
    )
  }
  if (!match) return null

  const isLive = match.status === "live"
  const homeGoals = match.goals?.filter(g => g.team_id === match.home_team?.id) || []
  const awayGoals = match.goals?.filter(g => g.team_id === match.away_team?.id) || []
  const kickoff = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleString([], {
        month: "long", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "TBD"

  return (
    <>
      {/* Hero-style scoreboard */}
      <div className="hero overlay" style={{ backgroundImage: "url('/images/hero_4.jpg')", minHeight: 320 }}>
        <div className="container h-100 d-flex align-items-center">
          <div className="w-100">
            <button className="btn-back" onClick={onBack}>
              ← Back to Matches
            </button>
            <div className="d-flex team-vs" style={{ marginTop: 0 }}>
              <span className="score" style={{ fontSize: isLive ? "3rem" : "2rem" }}>
                {isLive && <span className="live-indicator" />}
                {match.home_score ?? "-"}
                {"-"}
                {match.away_score ?? "-"}
              </span>

              {/* Home team */}
              <div className="team-1 w-50">
                <div className="team-details w-100 text-center">
                  {match.home_team?.flag_url
                    ? <img src={match.home_team.flag_url} alt="" className="logo-lg" style={{ margin: "0 auto 8px" }} />
                    : <span style={{ fontSize: "3rem" }}>🏳️</span>
                  }
                  <h3>{translateTeam(match.home_team?.name, i18n.language)}</h3>
                  <ul className="list-unstyled">
                    {homeGoals.map(g => (
                      <li key={g.id} style={{ fontSize: "0.85rem" }}>⚽ {g.player_name} {g.minute}'</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Away team */}
              <div className="team-2 w-50">
                <div className="team-details w-100 text-center">
                  {match.away_team?.flag_url
                    ? <img src={match.away_team.flag_url} alt="" className="logo-lg" style={{ margin: "0 auto 8px" }} />
                    : <span style={{ fontSize: "3rem" }}>🏳️</span>
                  }
                  <h3>{translateTeam(match.away_team?.name, i18n.language)}</h3>
                  <ul className="list-unstyled">
                    {awayGoals.map(g => (
                      <li key={g.id} style={{ fontSize: "0.85rem" }}>⚽ {g.player_name} {g.minute}'</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match info + stats */}
      <div className="site-section bg-dark">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>{t("match.info")}</h3>
                </div>
                <div className="widget-body text-center widget-vs-contents py-3">
                  <h4>{match.round || match.group_stage}</h4>
                  <p>
                    <span className="d-block">{kickoff}</span>
                    <strong className="text-primary">{match.venue}</strong>
                  </p>
                  <p>
                    <span
                      className={`d-inline-block px-3 py-1 rounded ${isLive ? "text-white" : ""}`}
                      style={{
                        background: isLive ? "#ee1e46" : "rgba(255,255,255,0.1)",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 1
                      }}
                    >
                      {isLive && <span className="live-indicator" />}
                      {match.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              {match.match_stats && match.match_stats.length > 0 ? (
                <LiveStats
                  stats={match.match_stats}
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                />
              ) : (
                <div className="widget-next-match">
                  <div className="widget-title"><h3>{t("live.matchStats")}</h3></div>
                  <div className="widget-body text-center py-4">
                    <p style={{ color: "gray" }}>Stats will appear when the match starts</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
