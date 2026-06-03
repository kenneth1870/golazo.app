import { useState, useCallback } from "react"
import { useMatch } from "../hooks/useMatches"
import { useMatchChannel } from "../hooks/useMatchChannel"
import LiveStats from "./LiveStats"

export default function MatchDetail({ matchId, onBack }) {
  const { match, loading, setMatch } = useMatch(matchId)

  const handleMessage = useCallback((data) => {
    setMatch(prev => {
      if (!prev) return prev
      if (data.type === "score_update") {
        return { ...prev, home_score: data.home_score, away_score: data.away_score, status: data.status }
      }
      if (data.type === "goal") {
        return { ...prev, goals: [...(prev.goals || []), data.goal], home_score: data.home_score, away_score: data.away_score }
      }
      if (data.type === "stats_update") {
        return { ...prev, match_stats: data.stats }
      }
      return prev
    })
  }, [setMatch])

  useMatchChannel(matchId, handleMessage)

  if (loading) return <div className="loading">Loading match...</div>
  if (!match) return <div className="error">Match not found</div>

  const isLive = match.status === "live"
  const homeGoals = match.goals?.filter(g => g.team_id === match.home_team?.id) || []
  const awayGoals = match.goals?.filter(g => g.team_id === match.away_team?.id) || []

  return (
    <div className="match-detail">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <div className={`detail-scoreboard ${isLive ? "live" : ""}`}>
        {isLive && <div className="live-badge pulsing">LIVE</div>}

        <div className="detail-meta">
          <span>{match.round || match.group_stage}</span>
          <span className="dot">·</span>
          <span>{match.venue}</span>
        </div>

        <div className="detail-teams">
          <div className="detail-team">
            {match.home_team?.flag_url && (
              <img src={match.home_team.flag_url} alt="" className="flag-lg" />
            )}
            <div className="detail-team-name">{match.home_team?.name}</div>
            <div className="goal-list">
              {homeGoals.map(g => (
                <div key={g.id} className="goal-entry">⚽ {g.player_name} {g.minute}'</div>
              ))}
            </div>
          </div>

          <div className="detail-score">
            <span className="score-big">{match.home_score ?? "-"}</span>
            <span className="score-colon">:</span>
            <span className="score-big">{match.away_score ?? "-"}</span>
          </div>

          <div className="detail-team">
            {match.away_team?.flag_url && (
              <img src={match.away_team.flag_url} alt="" className="flag-lg" />
            )}
            <div className="detail-team-name">{match.away_team?.name}</div>
            <div className="goal-list">
              {awayGoals.map(g => (
                <div key={g.id} className="goal-entry">{g.player_name} {g.minute}' ⚽</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {match.match_stats && match.match_stats.length > 0 && (
        <LiveStats stats={match.match_stats} homeTeam={match.home_team} awayTeam={match.away_team} />
      )}
    </div>
  )
}
