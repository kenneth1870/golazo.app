export default function MatchCard({ match, onClick }) {
  const isLive = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore = match.home_score !== null && match.away_score !== null

  const kickoffTime = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "--:--"

  return (
    <div className={`match-card ${isLive ? "live" : ""}`} onClick={onClick}>
      {isLive && <div className="live-badge">LIVE</div>}

      <div className="match-meta">
        <span className="match-round">{match.round || match.group_stage}</span>
        <span className="match-venue">{match.venue}</span>
      </div>

      <div className="match-teams">
        <div className="team home">
          {match.home_team?.flag_url && (
            <img src={match.home_team.flag_url} alt={match.home_team.code} className="flag" />
          )}
          <span className="team-code">{match.home_team?.code}</span>
          <span className="team-name">{match.home_team?.name}</span>
        </div>

        <div className="score-block">
          {hasScore ? (
            <>
              <span className={`score ${isLive ? "live-score" : ""}`}>
                {match.home_score}
              </span>
              <span className="score-sep">:</span>
              <span className={`score ${isLive ? "live-score" : ""}`}>
                {match.away_score}
              </span>
            </>
          ) : (
            <span className="kickoff-time">{kickoffTime}</span>
          )}
        </div>

        <div className="team away">
          <span className="team-name">{match.away_team?.name}</span>
          <span className="team-code">{match.away_team?.code}</span>
          {match.away_team?.flag_url && (
            <img src={match.away_team.flag_url} alt={match.away_team.code} className="flag" />
          )}
        </div>
      </div>

      {match.goals && match.goals.length > 0 && (
        <div className="goal-summary">
          {match.goals.map(g => (
            <span key={g.id} className="goal-item">
              {g.team_id === match.home_team?.id ? "⚽" : ""} {g.player_name} {g.minute}'
              {g.team_id === match.away_team?.id ? " ⚽" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
