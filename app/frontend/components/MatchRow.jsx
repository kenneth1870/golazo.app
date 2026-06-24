import { useState } from "react"
import { formatKickoff, formatMatchDate } from "../hooks/useLocalTime"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"

function FlagOrPlaceholder({ src, name }) {
  const [err, setErr] = useState(false)
  if (src && !err) {
    return <img src={src} alt={name} className="flag-xs" onError={() => setErr(true)} />
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 16, height: 16, borderRadius: "50%",
      background: "var(--surface2)", border: "1px solid var(--border)",
      fontSize: 8, fontWeight: 800, color: "var(--muted)", flexShrink: 0,
    }}>
      {name?.slice(0, 1)?.toUpperCase() || "?"}
    </span>
  )
}

export default function MatchRow({ match, onClick, showDate = false, showMeta = true }) {
  const { i18n } = useTranslation()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  return (
    <div className={`match-row${isLive ? " match-row--live" : ""}${onClick ? " match-row--clickable" : ""}`} onClick={onClick}>
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">
              {showDate && <span className="match-date">{formatMatchDate(match.kickoff_at, i18n.language)}</span>}
              {formatKickoff(match.kickoff_at, i18n.language)}
            </span>
        }
      </div>

      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          <FlagOrPlaceholder src={match.home_team?.flag_url} name={match.home_team?.name} />
          <span className="team-name">
            {translateTeam(match.home_team?.name, i18n.language) || match.home_slot || "TBD"}
          </span>
        </div>

        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>

        <div className="match-row__team match-row__team--away">
          <span className="team-name">
            {translateTeam(match.away_team?.name, i18n.language) || match.away_slot || "TBD"}
          </span>
          <FlagOrPlaceholder src={match.away_team?.flag_url} name={match.away_team?.name} />
        </div>
      </div>

      {showMeta && (
        <div className="match-row__meta">
          <span>{match.round || match.group_stage}</span>
          {match.competition?.code && <span className="competition-badge">{match.competition.code}</span>}
        </div>
      )}
    </div>
  )
}
