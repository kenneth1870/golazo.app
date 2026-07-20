import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches } from "../../hooks/useMatches"
import { usePageMeta } from "../../hooks/usePageMeta"
import { navigateToMatch, navIdFor } from "../../utils/matchDetailCache"
import FlagImg from "../../components/FlagImg"
import { translateTeam } from "../../i18n/teamNames"
import { formatKickoff } from "../../hooks/useLocalTime"

// ── Round name i18n ────────────────────────────────────
const ROUND_KEYS = {
  "Round of 32":   "bracket.roundOf32",
  "Round of 16":   "bracket.roundOf16",
  "Quarter Final": "bracket.quarterFinals",
  "Semi Final":    "bracket.semiFinals",
  "3rd Place":     "bracket.thirdPlace",
  "Final":         "bracket.final",
}

// ── Slot code → human label ────────────────────────────
// Codes: "1A"/"2A" = 1st/2nd of Group A; "T1"-"T8" = best 3rd-placed; "Wn"/"Ln" = winner/loser of match n
function slotLabel(code, lang) {
  if (!code) return "TBD"
  const m1 = code.match(/^([12])([A-L])$/)
  if (m1) {
    const pos = m1[1] === "1" ? (lang === "es" ? "1°" : "1st") : (lang === "es" ? "2°" : "2nd")
    return `${pos} Grupo ${m1[2]}`
  }
  if (/^T\d+$/.test(code)) return lang === "es" ? "Mejor 3°" : "Best 3rd"
  if (/^W(\d+)$/.test(code)) {
    const n = code.slice(1)
    return lang === "es" ? `Gan. partido ${n}` : `Winner M${n}`
  }
  if (/^L(\d+)$/.test(code)) {
    const n = code.slice(1)
    return lang === "es" ? `Perd. partido ${n}` : `Loser M${n}`
  }
  return code
}

// ── Phase label from match fields ─────────────────────
function phaseLabel(match, t) {
  if (match.group_stage) return `${t("scores.groupStage", "Fase de Grupos")} · ${match.group_stage}`
  if (match.round) {
    const key = ROUND_KEYS[match.round]
    return key ? t(key, match.round) : match.round
  }
  return t("scores.knockout", "Eliminatorias")
}

// ── Single fixture card (screenshot style) ────────────
function FixtureCard({ match, onClick }) {
  const { t, i18n } = useTranslation()

  const homeName = translateTeam(match.home_team?.name, i18n.language) || slotLabel(match.home_slot, i18n.language)
  const awayName = translateTeam(match.away_team?.name, i18n.language) || slotLabel(match.away_slot, i18n.language)

  const hasScore   = match.home_score !== null && match.away_score !== null
  const isFinished = match.status === "finished"
  const isLive     = match.status === "live"

  const dateStr = match.kickoff_at
    ? new Date(match.kickoff_at).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "UTC" })
    : "—"
  const timeStr = match.kickoff_at
    ? formatKickoff(match.kickoff_at, i18n.language)
    : t("time.tbd")

  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface2, rgba(255,255,255,.06))",
        border: "1px solid var(--border, rgba(255,255,255,.08))",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        transition: "background .15s",
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = "rgba(255,255,255,.1)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--surface2, rgba(255,255,255,.06))")}
    >
      {/* Teams */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <TeamRow name={homeName} flag={match.home_team?.flag_url} />
        <TeamRow name={awayName} flag={match.away_team?.flag_url} />
      </div>

      {/* Date / time / score */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 56 }}>
        {isLive ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", marginBottom: 4 }}>
              <span className="live-dot" />
              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#ee1e46", letterSpacing: 1 }}>LIVE</span>
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 900, color: "#ee1e46", lineHeight: 1 }}>
              {match.home_score} – {match.away_score}
            </div>
          </>
        ) : hasScore ? (
          <>
            <div style={{ fontSize: "0.6rem", color: "var(--muted)", marginBottom: 4, fontWeight: 500 }}>
              {isFinished ? "FT" : dateStr}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>
              {match.home_score} – {match.away_score}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 500, marginBottom: 4 }}>{dateStr}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)" }}>{timeStr}</div>
          </>
        )}
      </div>
    </div>
  )
}

function TeamRow({ name, flag }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <FlagImg src={flag} name={name} size={18} className="flag-xs" style={{ flexShrink: 0 }} />
      <span style={{
        fontSize: "0.82rem", fontWeight: 600, color: "var(--text)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name}
      </span>
    </div>
  )
}

// ── Phase section: header + card grid ─────────────────
function PhaseSection({ phase, matches, onMatchClick }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: "0.72rem", fontWeight: 800, color: "#ee1e46",
        textTransform: "uppercase", letterSpacing: ".08em",
        marginBottom: 14, paddingLeft: 2,
      }}>
        {phase}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}>
        {matches.map(m => (
          <FixtureCard
            key={m.id}
            match={m}
            onClick={navIdFor(m) ? () => onMatchClick(m) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// ── Date section ──────────────────────────────────────
function DateSection({ dateLabel, phaseGroups, onMatchClick }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{
        fontSize: "1rem", fontWeight: 700, color: "var(--text)",
        marginBottom: 20, paddingBottom: 10,
        borderBottom: "1px solid var(--border)",
      }}>
        {dateLabel}
      </h2>
      {Object.entries(phaseGroups).map(([phase, matches]) => (
        <PhaseSection key={phase} phase={phase} matches={matches} onMatchClick={onMatchClick} />
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────
function Skeleton() {
  return (
    <div>
      {[3, 2, 4].map((n, si) => (
        <div key={si} style={{ marginBottom: 40 }}>
          <div className="loading-shimmer" style={{ width: 160, height: 12, borderRadius: 4, marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className="loading-shimmer" style={{ height: 88, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────
export default function SchedulePage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("mundial.scheduleTitle"), "Full FIFA World Cup 2026 schedule — all 104 matches, kickoff times and venues.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()

  const onMatchClick = (m) => navigateToMatch(navigate, m)

  // Group: date → phase → matches[]
  const byDate = {}
  for (const m of matches) {
    const dateLabel = m.kickoff_at
      ? new Date(m.kickoff_at).toLocaleDateString(i18n.language, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
      : "TBD"
    const phase = phaseLabel(m, t)

    if (!byDate[dateLabel]) byDate[dateLabel] = {}
    if (!byDate[dateLabel][phase]) byDate[dateLabel][phase] = []
    byDate[dateLabel][phase].push(m)
  }

  if (loading) {
    return (
      <div className="site-section">
        <div className="container"><Skeleton /></div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        {Object.entries(byDate).map(([dateLabel, phaseGroups]) => (
          <DateSection
            key={dateLabel}
            dateLabel={dateLabel}
            phaseGroups={phaseGroups}
            onMatchClick={onMatchClick}
          />
        ))}
      </div>
    </div>
  )
}
