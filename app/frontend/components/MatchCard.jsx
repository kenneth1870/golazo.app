export default function MatchCard({ match, onClick }) {
  const isLive = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore = match.home_score !== null && match.away_score !== null

  const kickoff = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleString([], {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      })
    : "TBD"

  const homeGoals = match.goals?.filter(g => g.team_id === match.home_team?.id) || []
  const awayGoals = match.goals?.filter(g => g.team_id === match.away_team?.id) || []

  return (
    <div
      className="d-flex team-vs"
      onClick={onClick}
      style={{ cursor: "pointer", marginBottom: "30px" }}
    >
      {hasScore && (
        <span className="score">
          {isLive && <span className="live-indicator" />}
          {match.home_score}-{match.away_score}
        </span>
      )}
      {!hasScore && (
        <span className="score" style={{ fontSize: "1.1rem" }}>{kickoff}</span>
      )}

      {/* Home team */}
      <div className="team-1 w-50">
        <div className="team-details w-100 text-center">
          {match.home_team?.flag_url
            ? <img src={match.home_team.flag_url} alt={match.home_team.code} className="img-fluid" style={{ maxHeight: 60, borderRadius: 4 }} />
            : <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🏳️</div>
          }
          <h3>
            {match.home_team?.code}
            {isFinished && match.home_score > match.away_score && <span> (win)</span>}
            {isFinished && match.home_score < match.away_score && <span> (loss)</span>}
          </h3>
          <ul className="list-unstyled">
            {homeGoals.map(g => (
              <li key={g.id}>⚽ {g.player_name} {g.minute}'</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Away team */}
      <div className="team-2 w-50">
        <div className="team-details w-100 text-center">
          {match.away_team?.flag_url
            ? <img src={match.away_team.flag_url} alt={match.away_team.code} className="img-fluid" style={{ maxHeight: 60, borderRadius: 4 }} />
            : <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🏳️</div>
          }
          <h3>
            {match.away_team?.code}
            {isFinished && match.away_score > match.home_score && <span> (win)</span>}
            {isFinished && match.away_score < match.home_score && <span> (loss)</span>}
          </h3>
          <ul className="list-unstyled">
            {awayGoals.map(g => (
              <li key={g.id}>⚽ {g.player_name} {g.minute}'</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
