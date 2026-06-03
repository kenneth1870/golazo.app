import { formatFull } from "../hooks/useLocalTime"

export default function UpcomingMatchWidget({ match, onClick }) {
  const kickoff = formatFull(match.kickoff_at)

  return (
    <div
      className="bg-light p-4 rounded"
      onClick={onClick}
      style={{ cursor: "pointer", marginBottom: "16px" }}
    >
      <div className="widget-body">
        <div className="widget-vs">
          <div className="d-flex align-items-center justify-content-around w-100">
            <div className="team-1 text-center">
              {match.home_team?.flag_url
                ? <img src={match.home_team.flag_url} alt={match.home_team.code} style={{ height: 48, borderRadius: 3 }} />
                : <span style={{ fontSize: "2rem" }}>🏳️</span>
              }
              <h3 style={{ fontSize: "0.9rem", marginTop: 8 }}>{match.home_team?.name}</h3>
            </div>
            <div>
              <span className="vs"><span>VS</span></span>
            </div>
            <div className="team-2 text-center">
              {match.away_team?.flag_url
                ? <img src={match.away_team.flag_url} alt={match.away_team.code} style={{ height: 48, borderRadius: 3 }} />
                : <span style={{ fontSize: "2rem" }}>🏳️</span>
              }
              <h3 style={{ fontSize: "0.9rem", marginTop: 8 }}>{match.away_team?.name}</h3>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center widget-vs-contents mt-3">
        <h4>{match.round || match.group_stage}</h4>
        <p>
          <span className="d-block">{kickoff}</span>
          <strong className="text-primary">{match.venue}</strong>
        </p>
      </div>
    </div>
  )
}
