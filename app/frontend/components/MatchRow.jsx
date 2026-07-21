import { useState } from "react"
import { formatKickoff, formatMatchDate } from "../hooks/useLocalTime"
import { useTranslation } from "react-i18next"
import { translateTeam, resolveTeamLogo } from "../i18n/teamNames"
import { prefetchMatchDetail, navIdFor } from "../utils/matchDetailCache"

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

export default function MatchRow({
  match,
  onClick,
  showDate = false,
  showMeta = true,
  flashing = false,
  showChevron = false,
  kickoffBelowStatus = false,
  metaLabel,
}) {
  const { t, i18n } = useTranslation()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null

  const homeName = translateTeam(match.home_team?.name, i18n.language) || match.home_slot || t("time.tbd")
  const awayName = translateTeam(match.away_team?.name, i18n.language) || match.away_slot || t("time.tbd")

  const kickoffTime = match.kickoff_tbc
    ? t("time.tbc")
    : formatKickoff(match.kickoff_at, i18n.language)

  const warm = onClick ? () => prefetchMatchDetail(navIdFor(match)) : undefined

  function handleKeyDown(e) {
    if (!onClick) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick(e)
    }
  }

  return (
    <div
      className={`match-row${isLive ? " match-row--live" : ""}${onClick ? " match-row--clickable" : ""}${flashing ? " match-row--score-flash" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? t("a11y.matchRow", { home: homeName, away: awayName }) : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'${match.minute_extra ? `+${match.minute_extra}` : ""}` : t("status.live")}</span>
          : isFinished
          ? <>
              <span className="match-status-ft">{t("status.ft")}</span>
              {kickoffBelowStatus && (
                <span style={{ fontSize: "0.65rem", color: "var(--muted)", display: "block" }}>{kickoffTime}</span>
              )}
            </>
          : <span className="match-status-time">
              {showDate && <span className="match-date">{formatMatchDate(match.kickoff_at, i18n.language)}</span>}
              {kickoffTime}
            </span>
        }
      </div>

      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          <FlagOrPlaceholder src={resolveTeamLogo(match.home_team?.name, match.home_team?.flag_url)} name={match.home_team?.name} />
          <span className="team-name">{homeName}</span>
          {match.home_red_cards > 0 && (
            <span className="red-card-badge">🟥{match.home_red_cards > 1 ? `×${match.home_red_cards}` : ""}</span>
          )}
        </div>

        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">{t("status.vs")}</span>
          }
          {match.home_pen_score != null && match.away_pen_score != null && (
            <span className="score-pill__pen">({match.home_pen_score} – {match.away_pen_score} {t("match.penShort")})</span>
          )}
        </div>

        <div className="match-row__team match-row__team--away">
          {match.away_red_cards > 0 && (
            <span className="red-card-badge">🟥{match.away_red_cards > 1 ? `×${match.away_red_cards}` : ""}</span>
          )}
          <span className="team-name">{awayName}</span>
          <FlagOrPlaceholder src={resolveTeamLogo(match.away_team?.name, match.away_team?.flag_url)} name={match.away_team?.name} />
        </div>
      </div>

      {showMeta && (
        <div className="match-row__meta">
          {showChevron
            ? <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>›</span>
            : metaLabel
            ? <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{metaLabel}</span>
            : <>
                <span>{match.round || match.group_stage}</span>
                {match.competition?.code && <span className="competition-badge">{match.competition.code}</span>}
              </>
          }
        </div>
      )}
    </div>
  )
}
