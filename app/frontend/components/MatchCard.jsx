import { formatMatchDateTime } from "../hooks/useLocalTime"

export default function MatchCard({ match, onClick }) {
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null
  const kickoff    = formatMatchDateTime(match.kickoff_at)

  const homeGoals = match.goals?.filter(g => g.team_id === match.home_team?.id) || []
  const awayGoals = match.goals?.filter(g => g.team_id === match.away_team?.id) || []

  // Exact template structure: .d-flex.team-vs
  return (
    <div
      className="d-flex team-vs"
      onClick={onClick}
      style={{ cursor: "pointer", marginBottom: 30 }}
    >
      {/* Score — template puts span.score inside .team-vs */}
      <span className="score" style={{ fontSize: hasScore ? undefined : "1rem" }}>
        {hasScore ? (
          <>
            {isLive && <span className="live-dot mr-1" />}
            {match.home_score}–{match.away_score}
          </>
        ) : kickoff}
      </span>

      {/* Home team */}
      <div className="team-1 w-50">
        <div className="team-details w-100 text-center">
          {match.home_team?.flag_url
            ? <img src={match.home_team.flag_url} alt={match.home_team.code} className="img-fluid" style={{ maxHeight: 60, borderRadius: 4, marginBottom: 8 }} />
            : <span style={{ fontSize: "2.5rem", display: "block" }}>🏳️</span>
          }
          <h3>
            {match.home_team?.name?.toUpperCase()}
            {isFinished && match.home_score > match.away_score && <span> (win)</span>}
            {isFinished && match.home_score < match.away_score && <span> (loss)</span>}
            {isFinished && match.home_score === match.away_score && <span> (draw)</span>}
          </h3>
          <ul className="list-unstyled">
            {homeGoals.map(g => (
              <li key={g.id}>⚽ {g.player_name} {g.minute}&apos;</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Away team */}
      <div className="team-2 w-50">
        <div className="team-details w-100 text-center">
          {match.away_team?.flag_url
            ? <img src={match.away_team.flag_url} alt={match.away_team.code} className="img-fluid" style={{ maxHeight: 60, borderRadius: 4, marginBottom: 8 }} />
            : <span style={{ fontSize: "2.5rem", display: "block" }}>🏳️</span>
          }
          <h3>
            {match.away_team?.name?.toUpperCase()}
            {isFinished && match.away_score > match.home_score && <span> (win)</span>}
            {isFinished && match.away_score < match.home_score && <span> (loss)</span>}
            {isFinished && match.away_score === match.home_score && <span> (draw)</span>}
          </h3>
          <ul className="list-unstyled">
            {awayGoals.map(g => (
              <li key={g.id}>⚽ {g.player_name} {g.minute}&apos;</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
