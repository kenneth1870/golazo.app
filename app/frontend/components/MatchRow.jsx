import { formatKickoff, formatMatchDate } from "../hooks/useLocalTime"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"

export default function MatchRow({ match, onClick, showDate = false }) {
  const { i18n } = useTranslation()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  return (
    <div className={`match-row${isLive ? " match-row--live" : ""}`} onClick={onClick}>
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">
              {showDate && <span className="match-date">{formatMatchDate(match.kickoff_at)}</span>}
              {formatKickoff(match.kickoff_at)}
            </span>
        }
      </div>

      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" className="flag-xs" />}
          <span className="team-name">{translateTeam(match.home_team?.name, i18n.language)}</span>
        </div>

        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>

        <div className="match-row__team match-row__team--away">
          <span className="team-name">{translateTeam(match.away_team?.name, i18n.language)}</span>
          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" className="flag-xs" />}
        </div>
      </div>

      <div className="match-row__meta">
        <span>{match.round || match.group_stage}</span>
        {match.competition && <span className="competition-badge">{match.competition.code}</span>}
      </div>
    </div>
  )
}
