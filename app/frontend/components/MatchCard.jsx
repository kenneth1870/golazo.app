import { useState } from "react"
import { useTranslation } from "react-i18next"
import { formatMatchDateTime } from "../hooks/useLocalTime"

function ResultBadge({ result }) {
  const map = { win: { label: "W", bg: "#10b981" }, loss: { label: "L", bg: "#ef4444" }, draw: { label: "D", bg: "#f59e0b" } }
  const info = map[result]
  if (!info) return null
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      background: info.bg, color: "#fff", fontSize: "0.62rem", fontWeight: 800,
      letterSpacing: 1, marginLeft: 6, verticalAlign: "middle",
    }}>{info.label}</span>
  )
}

function TeamFlag({ src, code, name, size = 72 }) {
  const [err, setErr] = useState(false)
  const initials = code?.slice(0, 3) || name?.slice(0, 3) || "?"
  if (src && !err) {
    return (
      <img src={src} alt={code} className="logo-lg"
        style={{ width: size, height: size, margin: "0 auto 8px", display: "block" }}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", margin: "0 auto 8px",
      background: "var(--surface2)", border: "2px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.28, fontWeight: 800, color: "var(--muted)",
    }}>{initials.toUpperCase()}</div>
  )
}

export default function MatchCard({ match, onClick }) {
  const { i18n } = useTranslation()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score !== null && match.away_score !== null
  const kickoff    = formatMatchDateTime(match.kickoff_at, i18n.language)

  const homeGoals = match.goals?.filter(g => g.team_id === match.home_team?.id) || []
  const awayGoals = match.goals?.filter(g => g.team_id === match.away_team?.id) || []

  const homeResult = isFinished
    ? match.home_score > match.away_score ? "win"
    : match.home_score < match.away_score ? "loss" : "draw"
    : null
  const awayResult = isFinished
    ? match.away_score > match.home_score ? "win"
    : match.away_score < match.home_score ? "loss" : "draw"
    : null

  return (
    <div
      className="team-vs"
      onClick={onClick}
      style={{ cursor: "pointer", marginBottom: 30, display: "flex", alignItems: "center", padding: "16px 12px" }}
    >
      {/* Home team */}
      <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
        <TeamFlag src={match.home_team?.flag_url} code={match.home_team?.code} name={match.home_team?.name} />
        <h3 style={{ fontSize: "clamp(.75rem, 3vw, 1rem)", margin: "4px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {match.home_team?.name?.toUpperCase()}
          {homeResult && <ResultBadge result={homeResult} />}
        </h3>
        <ul className="list-unstyled" style={{ fontSize: ".72rem", color: "var(--muted)", margin: 0 }}>
          {homeGoals.map(g => <li key={g.id}>⚽ {g.player_name} {g.minute}&apos;</li>)}
        </ul>
      </div>

      {/* Score / kickoff */}
      <div style={{ flexShrink: 0, textAlign: "center", padding: "0 12px", minWidth: 70 }}>
        {isLive && (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: "0.65rem", fontWeight: 700, color: "#ee1e46", letterSpacing: 1, marginBottom: 4 }}>
            <span className="live-dot" /> LIVE
          </span>
        )}
        <span className="score" style={{ fontSize: hasScore ? undefined : ".9rem" }}>
          {hasScore ? `${match.home_score}–${match.away_score}` : kickoff}
        </span>
        {isFinished && <div style={{ fontSize: "0.62rem", color: "var(--muted)", letterSpacing: 1, marginTop: 2 }}>FT</div>}
      </div>

      {/* Away team */}
      <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
        <TeamFlag src={match.away_team?.flag_url} code={match.away_team?.code} name={match.away_team?.name} />
        <h3 style={{ fontSize: "clamp(.75rem, 3vw, 1rem)", margin: "4px 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {match.away_team?.name?.toUpperCase()}
          {awayResult && <ResultBadge result={awayResult} />}
        </h3>
        <ul className="list-unstyled" style={{ fontSize: ".72rem", color: "var(--muted)", margin: 0 }}>
          {awayGoals.map(g => <li key={g.id}>⚽ {g.player_name} {g.minute}&apos;</li>)}
        </ul>
      </div>
    </div>
  )
}
