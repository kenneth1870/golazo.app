import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { formatFull } from "../hooks/useLocalTime"
import { translateTeam, resolveTeamLogo } from "../i18n/teamNames"
import { useAppFocus } from "../hooks/useAppFocus"

export default function UpcomingMatchWidget({ match, onClick }) {
  const { i18n } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()

  const kickoff = formatFull(match.kickoff_at, i18n.language)

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
              {(match.home_team?.flag_url || match.home_team?.name)
                ? <img src={resolveTeamLogo(match.home_team?.name, match.home_team?.flag_url)} alt={match.home_team.code} className="logo-md" style={{ margin: "0 auto" }} />
                : <span style={{ fontSize: "2rem" }}>🏳️</span>
              }
              <h3 style={{ fontSize: "0.9rem", marginTop: 8 }}>{translateTeam(match.home_team?.name, i18n.language) || match.home_team?.name}</h3>
            </div>
            <div>
              <span className="vs"><span>VS</span></span>
            </div>
            <div className="team-2 text-center">
              {(match.away_team?.flag_url || match.away_team?.name)
                ? <img src={resolveTeamLogo(match.away_team?.name, match.away_team?.flag_url)} alt={match.away_team.code} className="logo-md" style={{ margin: "0 auto" }} />
                : <span style={{ fontSize: "2rem" }}>🏳️</span>
              }
              <h3 style={{ fontSize: "0.9rem", marginTop: 8 }}>{translateTeam(match.away_team?.name, i18n.language) || match.away_team?.name}</h3>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center widget-vs-contents mt-3">
        <h4>{match.round || match.group_stage}</h4>
        <p>
          <span className="d-block">{kickoff}</span>
          {match.venue
            ? (clubsPrimary
                ? <span style={{ color: "var(--muted)" }}>📍 {match.venue}</span>
                : <Link
                    to={`/mundial/venues/${match.venue.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                    style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}
                  >
                    📍 {match.venue}
                  </Link>)
            : null
          }
        </p>
      </div>
    </div>
  )
}
