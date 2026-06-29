import { useState, useEffect, useRef, useCallback, memo } from "react"

// Decorative logo/flag image — returns null on error instead of hiding with display:none
// which leaves a DOM hole and can break flex layouts.
const SafeImg = memo(function SafeImg({ src, alt, className, style }) {
  const [err, setErr] = useState(false)
  if (!src || err) return null
  return <img src={src} alt={alt || ""} className={className} style={style} onError={() => setErr(true)} />
})
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../i18n/leagueNames"
import { translateTeam } from "../i18n/teamNames"
import { useExternalMatchChannel } from "../hooks/useExternalMatchChannel"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { useLiveMinute, useGoalNotifications } from "./match/useMatchLive"
import ScorePredictionPanel from "./match/ScorePredictionPanel"
import MatchReactions from "../components/MatchReactions"
import { useReminders } from "../hooks/useReminders"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useVisiblePolling } from "../hooks/useVisiblePolling"
import { getCachedMatchDetail, setCachedMatchDetail } from "../utils/matchDetailCache"
import { getMatchColor } from "../utils/teamColors"
import { sourceColor } from "../utils/sourceColors"
import { storageGet, storageSet } from "../utils/safeStorage"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"

// ─── Reminder button ──────────────────────────────────
function ReminderButton({ match }) {
  const { t } = useTranslation()
  const { isReminded, addReminder, removeReminder } = useReminders()
  const matchId = String(match?.external_id || match?.id || "")
  if (!matchId || !match?.kickoff_at) return null
  const kickoff = new Date(match.kickoff_at).getTime()
  if (kickoff <= Date.now()) return null

  const reminded = isReminded(matchId)
  const toggle = async () => {
    if (reminded) removeReminder(matchId)
    else await addReminder(match)
  }
  const kickoffLabel = new Date(match.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <button
      onClick={toggle}
      title={reminded ? t("match.reminderActive", { time: kickoffLabel }) : t("match.reminderSet", { time: kickoffLabel })}
      style={{
        background: reminded ? "rgba(16,185,129,.15)" : "none",
        border: reminded ? "1px solid rgba(16,185,129,.4)" : "1px solid var(--border)",
        borderRadius: 6, cursor: "pointer",
        color: reminded ? "#10b981" : "var(--muted)",
        fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4,
        padding: "5px 8px", transition: "all .2s",
      }}
    >
      {reminded ? `🔔 ${kickoffLabel}` : `🔕 ${t("match.remindMe")}`}
    </button>
  )
}

// ─── Share button ─────────────────────────────────────
function ShareButton({ homeName, awayName }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  function share() {
    const title = homeName && awayName ? `${homeName} vs ${awayName} — Golazo` : "Golazo"
    const url   = window.location.href
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {})
    } else {
      const fallback = () => {
        try {
          const ta = document.createElement("textarea")
          ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0"
          document.body.appendChild(ta); ta.select()
          document.execCommand("copy")
          document.body.removeChild(ta)
        } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true); setTimeout(() => setCopied(false), 2000)
        }).catch(fallback)
      } else {
        fallback()
      }
    }
  }

  return (
    <button
      onClick={share}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: copied ? "#10b981" : "var(--muted)",
        fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4,
        padding: "6px 0", transition: "color .2s",
      }}
    >
      {copied ? t("match.copied") : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {t("match.share")}
        </>
      )}
    </button>
  )
}

// ─── Position color map ────────────────────────────────
const POS_STYLE = {
  G:  { bg: "#f59e0b", shadow: "rgba(245,158,11,.4)",  label: "GK"  },
  D:  { bg: "#3b82f6", shadow: "rgba(59,130,246,.4)",  label: "DEF" },
  M:  { bg: "#10b981", shadow: "rgba(16,185,129,.4)",  label: "MID" },
  F:  { bg: "#ee1e46", shadow: "rgba(238,30,70,.4)",   label: "FWD" },
}
function posStyle(pos) { return POS_STYLE[pos] || POS_STYLE.M }

// ─── Event icon components ─────────────────────────────
function EventIcon({ type, detail }) {
  if (type === "Goal") {
    if (detail === "Own Goal")   return <span title="Own Goal">⚽<span style={{ fontSize: "0.55rem", verticalAlign: "top", color: "#ef4444", fontWeight: 800 }}>OG</span></span>
    if (detail === "Penalty")    return <span title="Penalty">⚽<span style={{ fontSize: "0.55rem", verticalAlign: "top", color: "#f59e0b", fontWeight: 800 }}>P</span></span>
    if (detail === "Missed Penalty") return <span title="Missed Penalty" style={{ fontSize: "1.1rem" }}>❌</span>
    return <span style={{ fontSize: "1.15rem" }}>⚽</span>
  }
  if (type === "Card") {
    if (detail === "Yellow Card") return (
      <span style={{ display: "inline-block", width: 14, height: 18, background: "#f59e0b", borderRadius: 2, boxShadow: "0 2px 6px rgba(245,158,11,.5)", flexShrink: 0 }} title="Yellow Card" />
    )
    if (detail === "Red Card") return (
      <span style={{ display: "inline-block", width: 14, height: 18, background: "#ef4444", borderRadius: 2, boxShadow: "0 2px 6px rgba(239,68,68,.5)", flexShrink: 0 }} title="Red Card" />
    )
    if (detail === "Second Yellow Card") return (
      <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }} title="Second Yellow">
        <span style={{ display: "inline-block", width: 10, height: 15, background: "#f59e0b", borderRadius: 2 }} />
        <span style={{ display: "inline-block", width: 10, height: 15, background: "#ef4444", borderRadius: 2 }} />
      </span>
    )
  }
  if (type === "subst")   return <span style={{ fontSize: "1rem" }} title="Substitution">🔄</span>
  if (type === "Var") {
    if (detail?.includes("cancelled") || detail?.includes("disallowed")) return <span title={detail}>📹❌</span>
    if (detail?.includes("Penalty confirmed"))  return <span title={detail}>📹✅</span>
    if (detail?.includes("Card upgrade"))       return <span title={detail}>📹🟥</span>
    return <span title={detail || "VAR"}>📹</span>
  }
  if (type === "injury")  return <span style={{ fontSize: "1rem" }} title="Injury">🩹</span>
  return <span>•</span>
}

function PeriodDivider({ label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, margin: "8px 0",
      color: "var(--muted)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1,
      textTransform: "uppercase",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ padding: "2px 10px", background: "var(--surface2)", borderRadius: 12, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  )
}

const STAT_ORDER = [
  "Ball Possession","Total Shots","Shots on Goal","Shots off Goal",
  "Blocked Shots","Corner Kicks","Offsides","Fouls",
  "Yellow Cards","Red Cards","Goalkeeper Saves","Passes %",
]

const STAT_I18N = {
  "Ball Possession":   "match.statBallPossession",
  "Total Shots":       "match.statTotalShots",
  "Shots on Goal":     "match.statShotsOnGoal",
  "Shots off Goal":    "match.statShotsOffGoal",
  "Blocked Shots":     "match.statBlockedShots",
  "Corner Kicks":      "match.statCornerKicks",
  "Offsides":          "match.statOffsides",
  "Fouls":             "match.statFouls",
  "Yellow Cards":      "match.statYellowCards",
  "Red Cards":         "match.statRedCards",
  "Goalkeeper Saves":  "match.statGoalkeeperSaves",
  "Passes %":          "match.statPassesAccuracy",
}

// ─── Score timeline (goal progression at a glance) ────
function ScoreTimeline({ events, homeTeamRaw, homeName, awayName, t }) {
  const goals = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
  if (!goals.length) return null

  let h = 0, a = 0
  const moments = goals.map(e => {
    const isOG      = e.detail === "Own Goal"
    const teamHome  = e.team?.name === homeTeamRaw
    // API-Football: for OG events `team` = the BENEFITING team (not the scorer's team).
    // Score: team is already the benefiting side — no flip needed.
    // Display: show OG scorer in their own team's column = opposite of benefiting team.
    if (teamHome) h++; else a++
    return {
      min:    `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`,
      player: e.player,
      isHome: isOG ? !teamHome : teamHome,
      isOG,
      isP:    e.detail === "Penalty",
      score:  `${h}–${a}`,
    }
  })

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        ⚽ {t("match.goalTimeline")}
      </div>
      {/* Team labels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 1fr", gap: 8, marginBottom: 4 }}>
        <div style={{ textAlign: "right", fontSize: "0.65rem", color: "#ee1e46", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{homeName}</div>
        <div />
        <div style={{ textAlign: "left",  fontSize: "0.65rem", color: "#3b82f6", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{awayName}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {moments.map((m, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 56px 1fr", alignItems: "center", gap: 8, padding: "3px 0" }}>
            {/* Home side */}
            <div style={{ textAlign: "right" }}>
              {m.isHome && (
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                    {m.player}
                    {m.isOG && <span style={{ color: "#ef4444", fontSize: "0.65rem" }}> OG</span>}
                    {m.isP  && <span style={{ color: "#f59e0b", fontSize: "0.65rem" }}> P</span>}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#ee1e46", fontWeight: 700 }}>{m.min}</span>
                </div>
              )}
            </div>
            {/* Score pill */}
            <div style={{
              textAlign: "center", fontWeight: 900, fontSize: "0.85rem", color: "var(--text)",
              background: "var(--surface2)", borderRadius: 6, padding: "4px 6px",
              border: "1px solid var(--border)", flexShrink: 0,
            }}>
              {m.score}
            </div>
            {/* Away side */}
            <div>
              {!m.isHome && (
                <div style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                    {m.player}
                    {m.isOG && <span style={{ color: "#ef4444", fontSize: "0.65rem" }}> OG</span>}
                    {m.isP  && <span style={{ color: "#f59e0b", fontSize: "0.65rem" }}> P</span>}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#3b82f6", fontWeight: 700 }}>{m.min}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Mini stats bar shown in Summary tab ──────────────
function MiniStatsBar({ stats, homeName, awayName }) {
  const { t } = useTranslation()
  if (!stats?.length) return null
  const [homeS, awayS] = stats
  const getStat = (s, type) => s?.stats?.find(r => r.type === type)?.value
  const possession = getStat(homeS, "Ball Possession")
  const totalShots = [getStat(homeS, "Total Shots"), getStat(awayS, "Total Shots")]
  const onTarget   = [getStat(homeS, "Shots on Goal"), getStat(awayS, "Shots on Goal")]

  if (!possession && !totalShots[0]) return null

  const homePoss  = parseInt(possession) || 50
  const awayPoss  = 100 - homePoss

  return (
    <div style={{
      background: "var(--surface2)", borderRadius: 10,
      padding: "12px 16px", marginBottom: 16,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Team labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>
        <span style={{ color: "#ee1e46" }}>{homeName}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.62rem" }}>{t("match.statStatsSnapshot")}</span>
        <span style={{ color: "#3b82f6" }}>{awayName}</span>
      </div>

      {/* Possession bar */}
      {possession && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{homePoss}%</span>
            <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{t("match.statBallPossession")}</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{awayPoss}%</span>
          </div>
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${homePoss}%`, background: "#ee1e46", transition: "width .4s" }} />
            <div style={{ flex: 1, background: "#3b82f6" }} />
          </div>
        </div>
      )}

      {/* Shots row */}
      {totalShots[0] !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{totalShots[0] ?? 0}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            {t("match.statShots")}{onTarget[0] !== undefined ? ` (${onTarget[0] ?? 0} / ${onTarget[1] ?? 0} ${t("match.statShotsOnTarget").toLowerCase()})` : ""}
          </span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{totalShots[1] ?? 0}</span>
        </div>
      )}
    </div>
  )
}

function parseVal(v) {
  if (v === null || v === undefined) return 0
  return parseInt(String(v).replace("%", "")) || 0
}

function formResult(match, teamId) {
  const hs = match.home?.score ?? null
  const as = match.away?.score ?? null
  if (hs === null || as === null || match.status !== "finished") return null
  const isHome = match.home_team_id === teamId
  if (isHome) return hs > as ? "W" : hs < as ? "L" : "D"
  return as > hs ? "W" : as < hs ? "L" : "D"
}

function FlagOrInitials({ name, src, size = 80 }) {
  const [err, setErr] = useState(false)
  const init = name?.slice(0, 3).toUpperCase() || "?"
  if (src && !err) {
    return (
      <img src={src} alt={name}
        className="scoreboard__crest" style={{ width: size, height: size }}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--surface2)", border: "2px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.28, fontWeight: 800, color: "var(--muted)",
    }}>{init}</div>
  )
}

// ─── Scoreboard ────────────────────────────────────────
function addToCalendar(fixture) {
  const home = fixture?.teams?.home?.name ?? "Home"
  const away = fixture?.teams?.away?.name ?? "Away"
  const title = `${home} vs ${away}`
  const start = fixture?.fixture?.date ? new Date(fixture.fixture.date) : null
  if (!start) return
  const end = new Date(start.getTime() + 105 * 60 * 1000) // 105 min

  function fmt(d) {
    return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  }

  const loc = [fixture?.fixture?.venue?.name, fixture?.fixture?.venue?.city]
    .filter(Boolean).join(", ")

  const desc = `${fixture?.league?.name ?? ""} — watch live on Golazo`.trim()
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Golazo//EN",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    loc ? `LOCATION:${loc}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n")

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `${home.replace(/\s+/g, "_")}_vs_${away.replace(/\s+/g, "_")}.ics`
  a.click()
  URL.revokeObjectURL(url)
}


function translateRound(round, t) {
  if (!round) return round
  const gs = round.match(/^Group Stage\s*-\s*(\d+)$/i)
  if (gs) return t("match.roundGroupStage", { n: gs[1] })
  const rs = round.match(/^Regular Season\s*-\s*(\d+)$/i)
  if (rs) return t("match.roundRegularSeason", { n: rs[1] })
  const keys = {
    "Round of 32":    "match.roundOf32",
    "Round of 16":    "match.roundOf16",
    "Quarter-finals": "match.roundQuarterFinal",
    "Semi-finals":    "match.roundSemiFinal",
    "3rd Place Final":"match.round3rdPlace",
    "Final":          "match.roundFinal",
  }
  return keys[round] ? t(keys[round]) : round
}

function Scoreboard({ fixture, isLive, liveMinute, liveExtra, matchId, onShare, onNotif, notifEnabled, notifSupported, events }) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [venueImg, setVenueImg] = useState(null)
  const [venueCap, setVenueCap] = useState(null)

  const venueId = fixture?.fixture?.venue?.id
  useEffect(() => {
    if (!venueId) return
    fetch(`/api/v1/venue_detail/${venueId}`)
      .then(r => r.json())
      .then(d => {
        if (d?.image) setVenueImg(d.image)
        if (d?.capacity) setVenueCap(d.capacity)
      })
      .catch(() => {})
  }, [venueId])

  const home   = fixture?.teams?.home
  const away   = fixture?.teams?.away
  const homeName = translateTeam(home?.name, i18n.language)
  const awayName = translateTeam(away?.name, i18n.language)
  const homeRaw  = home?.name   // raw API name for event comparison
  const teamColor = getMatchColor(home?.name, away?.name)
  const apiGoals = fixture?.goals

  // Derive score from events. Events are authoritative over the fixture goals
  // tally because VAR/offside corrections remove the event first — the fixture
  // goals counter can briefly lag and show a disallowed goal. When events have
  // at least one goal recorded we use their count; otherwise fall back to the
  // fixture API tally (handles the very start of a match before events load).
  // API-Football: for OG events `team` = the BENEFITING team — no flip needed.
  let hFromEvents = 0, aFromEvents = 0
  const goalEvents = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
  goalEvents.forEach(e => {
    if (e.team?.name === homeRaw) hFromEvents++
    else aFromEvents++
  })
  const hasGoalEvents = goalEvents.length > 0 || (apiGoals?.home === 0 && apiGoals?.away === 0)
  const goals = {
    home: hasGoalEvents ? hFromEvents : (apiGoals?.home ?? 0),
    away: hasGoalEvents ? aFromEvents : (apiGoals?.away ?? 0),
  }
  const status = fixture?.fixture?.status
  const isNS   = status?.short === "NS"
  const isFT   = status?.short === "FT" || status?.short === "AET" || status?.short === "PEN"
  const isHT   = status?.short === "HT"

  function share() {
    const hs = goals?.home ?? "?"
    const as = goals?.away ?? "?"
    const lines = []

    // Header line
    if (isLive) {
      lines.push(`🔴 LIVE · ${homeName} ${hs}–${as} ${awayName}`)
    } else if (isFT) {
      const winner = hs > as ? homeName : as > hs ? awayName : null
      lines.push(`⚽ FT · ${homeName} ${hs}–${as} ${awayName}${winner ? ` · ${winner} win` : " · Draw"}`)
    } else {
      lines.push(`${homeName} vs ${awayName}`)
    }

    // Round/competition
    if (fixture?.league?.round) lines.push(`📅 ${fixture.league.round}`)

    // Goal scorers
    const goalEvents = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
    if (goalEvents.length > 0) {
      const homeGoals = goalEvents.filter(e => e.team?.name === homeRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
      const awayGoals = goalEvents.filter(e => e.team?.name !== homeRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
      if (homeGoals) lines.push(`  ${homeName}: ${homeGoals}`)
      if (awayGoals) lines.push(`  ${awayName}: ${awayGoals}`)
    }

    lines.push(window.location.href)
    const text = lines.join("\n")

    const fallback = () => {
      try {
        const ta = document.createElement("textarea")
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"
        document.body.appendChild(ta); ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      } catch {}
      navigator.vibrate?.(50)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.share) {
      navigator.share({ title: `${homeName} vs ${awayName}`, text, url: window.location.href }).catch(fallback)
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { navigator.vibrate?.(50); setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(fallback)
    } else { fallback() }
    onShare?.()
  }

  const kickoffStr = fixture?.fixture?.date
    ? new Date(fixture.fixture.date).toLocaleString([], {
        weekday: "short", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null

  return (
    <div
      className="scoreboard"
      style={{
        ...(teamColor ? { "--team-color": teamColor, "--team-color-dim": `${teamColor}22` } : {}),
        ...(venueImg ? {
          backgroundImage: `url(${venueImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center 40%",
        } : {}),
      }}
    >
      {venueImg && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(4,8,18,.78) 0%, rgba(4,8,18,.92) 100%)",
          zIndex: 0,
        }} />
      )}
      <div className="scoreboard__half scoreboard__half--home" style={teamColor ? { background: `linear-gradient(135deg, ${teamColor}18 0%, transparent 70%)` } : {}} />
      <div className="scoreboard__half scoreboard__half--away" />

      <div className="container scoreboard__inner" style={{ maxWidth: 740 }}>

        {/* Competition row */}
        <div className="scoreboard__competition">
          <SafeImg src={fixture?.league?.logo} style={{ width: 18, height: 18, objectFit: "contain" }} />
          <span>{translateLeague(fixture?.league?.name, i18n.language)}</span>
          {fixture?.league?.round && (
            <span className="scoreboard__round">{translateRound(fixture.league.round, t)}</span>
          )}
        </div>

        {/* Status pill */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          {isLive ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(238,30,70,.15)", border: "1px solid rgba(238,30,70,.4)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: ".72rem", fontWeight: 800, color: "#ee1e46", letterSpacing: ".06em",
            }}>
              <span className="live-dot" />
              {liveMinute ? `${liveMinute}${liveExtra ? `+${liveExtra}` : ""}'` : t("status.live")}
              {isHT && t("match.halfTimeShort")}
            </div>
          ) : isFT ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: ".72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".06em",
            }}>
              {t("match.fullTime")}
            </div>
          ) : isNS && kickoffStr ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: ".72rem", fontWeight: 600, color: "rgba(255,255,255,.5)",
            }}>
              {kickoffStr}
            </div>
          ) : (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: ".72rem", fontWeight: 700, color: "rgba(255,255,255,.5)",
            }}>
              {status?.long || status?.short || "—"}
            </div>
          )}
        </div>

        {/* Teams + Score */}
        <div className="scoreboard__teams">
          <div className="scoreboard__team">
            <FlagOrInitials name={home?.name} src={home?.logo} size={76} />
            <div className={`scoreboard__team-name${isFT && home?.winner ? " scoreboard__team-name--winner" : ""}`}>
              {homeName}
            </div>
          </div>

          <div className="scoreboard__score-block">
            <div className="scoreboard__score" style={{ gap: 12 }}>
              <span style={{ color: isFT && home?.winner ? "#10b981" : "#fff" }}>{goals?.home ?? (isNS ? "–" : "0")}</span>
              <span className="scoreboard__score-sep">:</span>
              <span style={{ color: isFT && away?.winner ? "#10b981" : "#fff" }}>{goals?.away ?? (isNS ? "–" : "0")}</span>
            </div>
            {isFT && home?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "#10b981" }}>
                {homeName} WIN
              </div>
            )}
            {isFT && away?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "#10b981" }}>
                {awayName} WIN
              </div>
            )}
          </div>

          <div className="scoreboard__team scoreboard__team--away">
            <FlagOrInitials name={away?.name} src={away?.logo} size={76} />
            <div className={`scoreboard__team-name${isFT && away?.winner ? " scoreboard__team-name--winner" : ""}`}>
              {awayName}
            </div>
          </div>
        </div>

        {/* Footer: venue + referee + share + notif */}
        <div className="scoreboard__footer">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {fixture?.fixture?.venue?.name && (
              <Link
                to={`/mundial/venues/${fixture.fixture.venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                className="scoreboard__venue"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                📍 {fixture.fixture.venue.name}
                {fixture.fixture.venue.city ? `, ${fixture.fixture.venue.city}` : ""}
                {venueCap ? <span style={{ opacity: .5, marginLeft: 6 }}>· 🏟️ {venueCap.toLocaleString()}</span> : null}
              </Link>
            )}
            {fixture?.fixture?.referee && (
              <span className="scoreboard__venue" style={{ fontSize: ".68rem" }}>
                ⚖️ {fixture.fixture.referee.replace(/ \(.*?\)$/, "")}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {(isLive || isNS) && notifSupported && (
              <button
                onClick={onNotif}
                title={notifEnabled ? t("match.notifDisable") : t("match.notifEnable")}
                style={{
                  background: notifEnabled ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.08)",
                  border: notifEnabled ? "1px solid rgba(16,185,129,.4)" : "1px solid rgba(255,255,255,.15)",
                  borderRadius: 20, padding: "5px 12px",
                  color: notifEnabled ? "#10b981" : "rgba(255,255,255,.5)",
                  fontSize: ".72rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {notifEnabled ? `🔔 ${t("match.notifOn")}` : `🔕 ${t("match.notifOff")}`}
              </button>
            )}
            {isNS && fixture?.fixture?.date && (
              <button
                onClick={() => addToCalendar(fixture)}
                title="Add to calendar"
                style={{
                  background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)",
                  borderRadius: 20, padding: "5px 12px",
                  color: "rgba(255,255,255,.5)",
                  fontSize: ".72rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("match.calendar")}
              </button>
            )}
            <button onClick={share} className={`scoreboard__share${copied ? " copied" : ""}`}>
              {copied ? t("match.copied") : t("match.share")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab components ────────────────────────────────────
function FormPill({ result }) {
  if (!result) return null
  const colors = { W: "#10b981", D: "#f59e0b", L: "#ef4444" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: "50%",
      background: colors[result] || "#333",
      fontSize: "0.65rem", fontWeight: 800, color: "#fff",
    }}>{result}</span>
  )
}

function EventsTimeline({ events, homeTeam, awayTeam, statusShort, t, i18n }) {
  if (!events?.length) return null

  const RELEVANT_TYPES = ["Goal", "Card", "subst", "Var", "injury"]
  const relevant = events.filter(e => RELEVANT_TYPES.includes(e.type))
  if (!relevant.length) return null

  // Separate regular time + penalty shootout events
  const regularEvents  = relevant.filter(e => e.period !== "Penalty")
  const penaltyEvents  = relevant.filter(e => e.period === "Penalty")

  // Build list with period dividers inserted
  const items = []
  let htInserted  = false
  let etInserted  = false
  let et2Inserted = false
  let htHomeGoals = 0, htAwayGoals = 0, htHomeCards = 0, htAwayCards = 0

  regularEvents.forEach(e => {
    const min = e.minute ?? 0
    if (!htInserted && min > 45) {
      items.push({ _divider: t("match.htDivider") })
      items.push({ _htSummary: { homeGoals: htHomeGoals, awayGoals: htAwayGoals, homeCards: htHomeCards, awayCards: htAwayCards } })
      htInserted = true
    }
    // Track first-half stats before HT divider
    if (!htInserted) {
      if (e.type === "Goal" && e.detail !== "Missed Penalty") {
        if (e.team?.name === homeTeam) htHomeGoals++; else htAwayGoals++
      }
      if (e.type === "Card") {
        if (e.team?.name === homeTeam) htHomeCards++; else htAwayCards++
      }
    }
    if (!etInserted && min > 90) {
      items.push({ _divider: t("match.etDivider") })
      etInserted = true
    }
    if (!et2Inserted && min > 105) {
      items.push({ _divider: t("match.et2Divider") })
      et2Inserted = true
    }
    items.push(e)
  })

  // Penalty shootout score trackers
  let homeGoals = 0, awayGoals = 0

  return (
    <section className="match-section">
      <h3 className="match-section__title">{t("match.events")}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((e, i) => {
          if (e._divider) return <PeriodDivider key={`d${i}`} label={e._divider} />
          if (e._htSummary) {
            const s = e._htSummary
            const hasActivity = s.homeGoals + s.awayGoals + s.homeCards + s.awayCards > 0
            if (!hasActivity) return null
            return (
              <div key={`ht-sum${i}`} style={{
                background: "var(--surface2)", borderRadius: 8, padding: "10px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: "0.76rem", color: "var(--muted)", margin: "4px 0 8px",
              }}>
                <div style={{ textAlign: "left" }}>
                  {s.homeGoals > 0 && <div>⚽ ×{s.homeGoals}</div>}
                  {s.homeCards > 0 && <div>🟨 ×{s.homeCards}</div>}
                </div>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.68rem", letterSpacing: ".06em", color: "var(--muted)", textTransform: "uppercase" }}>
                  1st half
                </div>
                <div style={{ textAlign: "right" }}>
                  {s.awayGoals > 0 && <div>⚽ ×{s.awayGoals}</div>}
                  {s.awayCards > 0 && <div>🟨 ×{s.awayCards}</div>}
                </div>
              </div>
            )
          }

          const teamHome  = e.team?.name === homeTeam
          const isGoal    = e.type === "Goal" && e.detail !== "Missed Penalty"
          const isMissed  = e.type === "Goal" && e.detail === "Missed Penalty"
          // For OG events API returns the BENEFITING team — flip column so scorer appears on their own side.
          const isHome    = (isGoal && e.detail === "Own Goal") ? !teamHome : teamHome
          const isSub     = e.type === "subst"
          const isVar     = e.type === "Var"
          const isCard    = e.type === "Card"
          const minuteStr = `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`
          const varCancelled = isVar && (e.detail?.toLowerCase().includes("cancel") || e.detail?.toLowerCase().includes("disallow"))

          return (
            <div key={`${e.minute}-${e.type}-${e.player ?? ""}-${i}`}
              className={`match-event${isGoal ? " match-event--goal" : ""}${isSub ? " match-event--sub" : ""}${isVar ? " match-event--var" : ""}${isMissed ? " match-event--missed" : ""}`}
              style={{ flexDirection: isHome ? "row" : "row-reverse", opacity: varCancelled ? 0.65 : 1 }}
            >
              <span className="match-event__minute">{minuteStr}</span>
              <span className="match-event__icon">
                <EventIcon type={e.type} detail={e.detail} />
              </span>
              <div className="match-event__info" style={{ textAlign: isHome ? "left" : "right" }}>
                <span className={`match-event__player${isGoal ? " match-event__player--goal" : ""}`}>
                  {e.player}
                </span>
                {isGoal && e.assist && (
                  <span className="match-event__assist"> {t("match.assist")}: {e.assist}</span>
                )}
                {isSub && e.assist && (
                  <span className="match-event__assist"> ↑ {e.assist}</span>
                )}
                {isVar && e.detail && (
                  <span className="match-event__assist" style={{ color: varCancelled ? "#ef4444" : "#10b981" }}>
                    {" "}{e.detail}
                    {e.comments ? ` — ${e.comments}` : ""}
                  </span>
                )}
                {isMissed && (
                  <span className="match-event__assist" style={{ color: "#ef4444" }}> {t("match.missedPenalty")}</span>
                )}
              </div>
              {!isSub && !isVar && (
                <span className="match-event__team" style={{ textAlign: isHome ? "right" : "left", fontSize: "0.68rem", color: "var(--muted)" }}>
                  {translateTeam(e.team?.name, i18n.language)}
                </span>
              )}
            </div>
          )
        })}

        {/* Penalty shootout */}
        {penaltyEvents.length > 0 && (
          <>
            <PeriodDivider label={t("match.penaltyShootout")} />
            {penaltyEvents.map((e, i) => {
              const isHome   = e.team?.name === homeTeam
              const scored   = e.detail !== "Missed Penalty"
              if (scored && isHome)  homeGoals++
              if (scored && !isHome) awayGoals++

              return (
                <div key={`pk${i}`}
                  className="match-event"
                  style={{ flexDirection: isHome ? "row" : "row-reverse", opacity: scored ? 1 : 0.55 }}
                >
                  <span className="match-event__minute">{i + 1}</span>
                  <span className="match-event__icon">
                    {scored ? "✅" : "❌"}
                  </span>
                  <div className="match-event__info" style={{ textAlign: isHome ? "left" : "right" }}>
                    <span className="match-event__player" style={{ color: scored ? "var(--text)" : "var(--muted)" }}>
                      {e.player}
                    </span>
                    <span className="match-event__assist" style={{ color: scored ? "#10b981" : "#ef4444" }}>
                      {scored ? " scored" : " missed"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--text)", minWidth: 36, textAlign: isHome ? "right" : "left" }}>
                    {homeGoals}–{awayGoals}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}

function StatBar({ label, homeVal, awayVal, isPct }) {
  const h = parseVal(homeVal)
  const a = parseVal(awayVal)
  const total = h + a || 1
  const homePct = isPct ? h : Math.round((h / total) * 100)
  // Display: always use the parsed number + suffix so we never double-append %
  const fmt = (v) => `${parseVal(v)}${isPct ? "%" : ""}`

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.8rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(homeVal)}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(awayVal)}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
        <div style={{ width: `${homePct}%`, background: "#ee1e46", transition: "width .4s" }} />
        <div style={{ flex: 1, background: "#3b82f6" }} />
      </div>
    </div>
  )
}

function StatsPanel({ stats, home, away, t, statusShort }) {
  const { i18n } = useTranslation()
  const isFT = ["FT", "AET", "PEN"].includes(statusShort)
  const isNS = statusShort === "NS"

  if (!stats?.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📊</div>
      <h3>{t("match.statsUnavailable")}</h3>
      <p style={{ maxWidth: 280, textAlign: "center" }}>
        {isFT ? t("match.statsNotProvided") : isNS ? t("match.statsAppear") : t("match.statsAppear")}
      </p>
    </div>
  )

  const [homeS, awayS] = stats
  const homeStat = (type) => homeS?.stats?.find(s => s.type === type)?.value
  const awayStat = (type) => awayS?.stats?.find(s => s.type === type)?.value
  const pairs = STAT_ORDER
    .map(type => ({ type, h: homeStat(type), a: awayStat(type) }))
    .filter(({ h, a }) => h !== null && h !== undefined && a !== null && a !== undefined)

  if (!pairs.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📊</div>
      <h3>{t("match.statsUnavailable")}</h3>
      <p style={{ maxWidth: 280, textAlign: "center" }}>
        {isFT ? t("match.statsNotProvided") : t("match.statsAppear")}
      </p>
    </div>
  )

  return (
    <section className="match-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SafeImg src={home?.logo} className="logo-sm" />
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ee1e46" }}>{translateTeam(home?.name, i18n.language)}</span>
        </div>
        <h3 className="match-section__title" style={{ margin: 0 }}>{t("match.statistics")}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#3b82f6" }}>{translateTeam(away?.name, i18n.language)}</span>
          <SafeImg src={away?.logo} className="logo-sm" />
        </div>
      </div>
      {pairs.map(({ type, h, a }) => (
        <StatBar key={type} label={t(STAT_I18N[type] || type)} homeVal={h} awayVal={a} isPct={String(h).includes("%")} />
      ))}
    </section>
  )
}

function PlayerDot({ number, pos, name }) {
  const ps       = posStyle(pos)
  const lastName = name?.split(" ").slice(-1)[0] || ""
  return (
    <div className="player-dot">
      <div className="player-dot__circle" style={{ background: ps.bg, boxShadow: `0 3px 10px ${ps.shadow}` }}>
        {number}
      </div>
      <div className="player-dot__pos" style={{ color: ps.bg }}>{ps.label}</div>
      <div className="player-dot__name">{lastName}</div>
    </div>
  )
}

function LineupTeam({ team, side }) {
  const { t, i18n } = useTranslation()
  if (!team?.start_xi?.length) return null
  const byRow = team.start_xi.reduce((acc, p) => {
    const row = p.grid?.split(":")[0] || "1"
    if (!acc[row]) acc[row] = []
    acc[row].push(p)
    return acc
  }, {})
  // Always show attackers at top (high row numbers first)
  const rows = Object.keys(byRow).sort((a, b) => b - a)

  return (
    <div className="lineup-team">
      {/* Team header */}
      <div className="lineup-team__header">
        <SafeImg src={team.team?.logo} className="logo-sm" />
        <div>
          <div className="lineup-team__name">{translateTeam(team.team?.name, i18n.language)}</div>
          {team.formation && (
            <div className="lineup-team__formation">{team.formation}</div>
          )}
        </div>
      </div>

      {/* Pitch */}
      <div className="lineup-pitch">
        <div className="lineup-pitch__lines" />
        {rows.map((row, ri) => (
          <div key={row} className="lineup-row">
            {byRow[row].map(p => (
              <PlayerDot key={p.number} number={p.number} pos={p.pos} name={p.name} />
            ))}
          </div>
        ))}
      </div>

      {/* Substitutes */}
      {team.subs?.length > 0 && (
        <div className="lineup-subs">
          <div className="lineup-subs__title">{t("match.substitutes")}</div>
          {team.subs.map((p, i) => {
            const ps = posStyle(p.pos)
            return (
              <div key={p.number ?? p.name ?? i} className="lineup-sub-row">
                <span className="lineup-sub-row__num" style={{ background: ps.bg }}>{p.number}</span>
                <span className="lineup-sub-row__name">{p.name}</span>
                <span className="lineup-sub-row__pos" style={{ color: ps.bg }}>{ps.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Position legend
function PosLegend() {
  return (
    <div className="pos-legend">
      {Object.entries(POS_STYLE).map(([k, v]) => (
        <span key={k} className="pos-legend__item">
          <span className="pos-legend__dot" style={{ background: v.bg }} />
          {v.label}
        </span>
      ))}
    </div>
  )
}

// ─── Match Preview Panel (predictions) ────────────────────────────────────────

function ComparisonBar({ label, home, away }) {
  const h = parseFloat(home) || 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: 4 }}>
        <span style={{ color: "#ee1e46", fontWeight: 700 }}>{home}</span>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: "0.62rem" }}>{label}</span>
        <span style={{ color: "#3b82f6", fontWeight: 700 }}>{away}</span>
      </div>
      <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
        <div style={{ width: `${h}%`, background: "#ee1e46", transition: "width .5s" }} />
        <div style={{ flex: 1, background: "#3b82f6" }} />
      </div>
    </div>
  )
}

function InjuriesSection({ fixtureId, homeName, awayName }) {
  const { t } = useTranslation()
  const [injuries, setInjuries] = useState(null)

  useEffect(() => {
    const apiId = String(fixtureId).replace(/^ext-/, "")
    let cancelled = false
    fetch(`/api/v1/fixture_injuries/${apiId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setInjuries(Array.isArray(d) && d.length ? d : []) })
      .catch(() => { if (!cancelled) setInjuries([]) })
    return () => { cancelled = true }
  }, [fixtureId])

  if (!injuries?.length) return null

  const byTeam = injuries.reduce((acc, inj) => {
    const name = inj.team?.name || "?"
    if (!acc[name]) acc[name] = []
    acc[name].push(inj)
    return acc
  }, {})

  return (
    <section className="match-section" style={{ marginBottom: 20 }}>
      <h3 className="match-section__title">🚑 {t("match.injuries")}</h3>
      {Object.entries(byTeam).map(([teamName, list]) => (
        <div key={teamName} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>{teamName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map((inj, i) => (
              <div key={inj.player?.name ? `${inj.player.name}-${i}` : i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--surface2)", borderRadius: 8 }}>
                {inj.player?.photo && (
                  <SafeImg src={inj.player.photo} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {inj.player?.name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{inj.reason}</div>
                </div>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700,
                  padding: "3px 8px", borderRadius: 10,
                  background: inj.type === "Missing Fixture" ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)",
                  color: inj.type === "Missing Fixture" ? "#ef4444" : "#f59e0b",
                  whiteSpace: "nowrap",
                }}>
                  {inj.type === "Missing Fixture" ? t("match.injuryOut") : t("match.injuryDoubt")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

function MatchPreviewPanel({ fixtureId, homeName, awayName, t }) {
  const [pred, setPred]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/fixture_predictions/${fixtureId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setPred(d?.percent ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fixtureId])

  if (loading) return (
    <div style={{ padding: "20px 0" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="loading-shimmer" style={{ height: 22, borderRadius: 6, marginBottom: 14 }} />
      ))}
    </div>
  )

  if (!pred) return (
    <div style={{ paddingBottom: 8 }}>
      <InjuriesSection fixtureId={fixtureId} homeName={homeName} awayName={awayName} />
      <div className="empty-state" style={{ paddingTop: 20 }}>
        <div className="empty-state__icon">🔮</div>
        <h3>{t("match.noPrediction")}</h3>
      </div>
    </div>
  )

  const { winner, percent, goals, advice, under_over, comparison } = pred
  const COMP_ROWS = [
    { key: "form",  label: t("match.predForm") },
    { key: "att",   label: t("match.predAttack") },
    { key: "def",   label: t("match.predDefense") },
    { key: "h2h",   label: t("match.h2h") },
    { key: "goals", label: t("match.predGoals") },
    { key: "total", label: t("match.predTotal") },
  ]

  return (
    <div style={{ paddingBottom: 8 }}>
      <InjuriesSection fixtureId={fixtureId} homeName={homeName} awayName={awayName} />
      {/* Win probability */}
      <div className="match-section" style={{ marginBottom: 20 }}>
        <div className="match-section__title">{t("match.winProbability")}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, marginTop: 10 }}>
          {[
            { label: homeName, pct: percent?.home, color: "#ee1e46" },
            { label: t("match.draw"),  pct: percent?.draw, color: "#f59e0b" },
            { label: awayName, pct: percent?.away, color: "#3b82f6" },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color }}>{pct ?? "—"}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: percent?.home, background: "#ee1e46" }} />
          <div style={{ width: percent?.draw, background: "#f59e0b" }} />
          <div style={{ flex: 1, background: "#3b82f6" }} />
        </div>
      </div>

      {/* Comparison bars */}
      {comparison && Object.values(comparison).some(Boolean) && (
        <div className="match-section" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 700, marginBottom: 14 }}>
            <span style={{ color: "#ee1e46" }}>{homeName}</span>
            <span style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: "0.6rem" }}>{t("match.comparison")}</span>
            <span style={{ color: "#3b82f6" }}>{awayName}</span>
          </div>
          {COMP_ROWS.map(({ key, label }) => {
            const val = comparison[key]
            if (!val?.home) return null
            return <ComparisonBar key={key} label={label} home={val.home} away={val.away} />
          })}
        </div>
      )}

      {/* Goals + Under/Over chips */}
      {(goals?.home || under_over) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {goals?.home && (
            <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{t("match.expectedGoals")}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>
                <span style={{ color: "#ee1e46" }}>{goals.home}</span>
                <span style={{ color: "var(--muted)", margin: "0 4px" }}>–</span>
                <span style={{ color: "#3b82f6" }}>{goals.away}</span>
              </div>
            </div>
          )}
          {under_over && (
            <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{t("match.underOver")}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#f59e0b" }}>{under_over}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "0.6rem", color: "var(--muted)", textAlign: "center", paddingTop: 4 }}>
        {t("match.predPoweredBy")}
      </div>
    </div>
  )
}

// ─── First Goal Scorer Odds ───────────────────────────────────────────────────

function FirstScorerOdds({ fixtureId, t }) {
  const [scorers, setScorers] = useState(null)

  useEffect(() => {
    if (!fixtureId) return
    setScorers(null)
    const controller = new AbortController()
    fetch(`/api/v1/fixture_odds/${fixtureId}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.bets) return
        const list =
          d.bets["First Goal Scorer"] ||
          d.bets["Anytime Goal Scorer"] ||
          d.bets["Home First Goal Scorer"] || []
        if (list.length > 0) {
          setScorers([...list].sort((a, b) => parseFloat(a.odd) - parseFloat(b.odd)).slice(0, 8))
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [fixtureId])

  if (!scorers?.length) return null

  return (
    <div className="match-section" style={{ marginTop: 20 }}>
      <div className="match-section__title" style={{ marginBottom: 12 }}>⚽ {t("match.firstGoalScorer")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scorers.map((s, i) => (
          <div key={s.value} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px",
            background: i === 0 ? "rgba(238,30,70,.07)" : "var(--surface2)",
            borderRadius: 8,
            border: i === 0 ? "1px solid rgba(238,30,70,.18)" : "1px solid transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", width: 18, textAlign: "center" }}>{i + 1}</span>
              <span style={{ fontWeight: i === 0 ? 700 : 500, fontSize: "0.85rem", color: "var(--text)" }}>{s.value}</span>
            </div>
            <span style={{
              background: i === 0 ? "rgba(238,30,70,.15)" : "var(--surface)",
              color: i === 0 ? "#ee1e46" : "var(--muted)",
              borderRadius: 6, padding: "3px 10px", fontSize: "0.8rem", fontWeight: 700,
            }}>{s.odd}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Lineups Panel ────────────────────────────────────────────────────────────

function LineupsPanel({ lineups, fixtureId, t, statusShort }) {
  // "Not started" statuses where lineups are simply not published yet
  const isPreKickoff = ["NS", "TBD"].includes(statusShort)
  const noData = !lineups?.length

  if (noData || !lineups.some(l => l?.start_xi?.length > 0)) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">👕</div>
      <h3>{isPreKickoff ? t("match.lineupsUnavailable") : t("match.lineupsNotProvided")}</h3>
      {isPreKickoff && (
        <p style={{ maxWidth: 280, textAlign: "center" }}>
          {t("match.lineupsRelease")}
        </p>
      )}
    </div>
  )
  const [home, away] = lineups
  return (
    <div>
      <PosLegend />
      <div className="lineups-grid">
        <LineupTeam team={home} side="home" />
        <LineupTeam team={away} side="away" />
      </div>
      {/* First goal scorer odds — shown for NS matches once lineups are available */}
      {isPreKickoff && <FirstScorerOdds fixtureId={fixtureId} t={t} />}
    </div>
  )
}

function FormRow({ label, matches, teamId }) {
  if (!matches?.length) return null
  const recent = [...matches].reverse()
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: "0.72rem", color: "var(--muted)", width: 80, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", gap: 5 }}>
        {recent.map((m, i) => <FormPill key={i} result={formResult(m, teamId)} />)}
      </div>
    </div>
  )
}

function H2HPanel({ h2h, homeTeamName, awayTeamName, t, lang }) {
  if (!h2h?.matches?.length) return (
    <div className="empty-state">
      <div className="empty-state__icon">📈</div>
      <h3>{t("match.noH2H")}</h3>
      <p>{t("match.h2hPrev")}</p>
    </div>
  )

  const computedSummary = (() => {
    let hw = 0, d = 0, aw = 0
    const homeLower = (homeTeamName || "").toLowerCase()
    const awayLower = (awayTeamName || "").toLowerCase()
    for (const m of h2h.matches) {
      const hs = Number(m.home?.score ?? NaN)
      const as_ = Number(m.away?.score ?? NaN)
      if (isNaN(hs) || isNaN(as_)) continue
      const mHomeLower = (m.home?.name || "").toLowerCase()
      const mAwayLower = (m.away?.name || "").toLowerCase()
      const homeIsHome = homeLower.split(" ").some(w => w.length > 2 && mHomeLower.includes(w))
      const homeIsAway = homeLower.split(" ").some(w => w.length > 2 && mAwayLower.includes(w))
      if (hs === as_) { d++; continue }
      if ((homeIsHome && hs > as_) || (homeIsAway && as_ > hs)) hw++
      else aw++
    }
    return [hw, d, aw]
  })()
  const [hw, d, aw] = h2h.summary || computedSummary
  const total = hw + d + aw || 1

  return (
    <>
      {/* Summary bar */}
      <section className="match-section">
        <h3 className="match-section__title">{t("match.h2hSummary")}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#ee1e46" }}>{hw}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{homeTeamName}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--muted)" }}>{d}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{t("match.draw")}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#3b82f6" }}>{aw}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{awayTeamName}</div>
          </div>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
          <div style={{ width: `${(hw/total)*100}%`, background: "#ee1e46" }} />
          <div style={{ width: `${(d/total)*100}%`, background: "var(--border)" }} />
          <div style={{ width: `${(aw/total)*100}%`, background: "#3b82f6" }} />
        </div>
      </section>

      {/* Match history */}
      <section className="match-section">
        <h3 className="match-section__title">{t("match.recentMeetings")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {h2h.matches.map((m, i) => {
            const hs   = m.home?.score ?? "–"
            const as   = m.away?.score ?? "–"
            const date = m.kickoff_at
              ? new Date(m.kickoff_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
              : ""
            const homeWon = Number(hs) > Number(as)
            const awayWon = Number(as) > Number(hs)
            return (
              <div key={m.kickoff_at ?? i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                background: i % 2 === 0 ? "transparent" : "var(--surface2)",
                borderRadius: 6, fontSize: "0.8rem",
              }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: ".65rem", color: "var(--muted)" }}>{date}</div>
                  {m.competition?.name && <div style={{ fontSize: ".58rem", color: "#555", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{translateLeague(m.competition.name, lang)}</div>}
                </div>
                <span style={{ flex: 1, textAlign: "right", fontWeight: homeWon ? 800 : 500, color: homeWon ? "var(--text)" : "var(--muted)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{translateTeam(m.home?.name, lang)}</span>
                <span style={{ fontWeight: 900, color: "var(--text)", padding: "3px 12px", background: "var(--surface2)", borderRadius: 4, fontSize: ".9rem", flexShrink: 0, minWidth: 64, textAlign: "center" }}>{hs} – {as}</span>
                <span style={{ flex: 1, fontWeight: awayWon ? 800 : 500, color: awayWon ? "var(--text)" : "var(--muted)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{translateTeam(m.away?.name, lang)}</span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

// ─── Player Ratings tab ───────────────────────────────
const RATING_COLOR = r => {
  const n = parseFloat(r)
  if (isNaN(n)) return "var(--muted)"
  if (n >= 8)   return "#10b981"
  if (n >= 6.5) return "#f59e0b"
  return "#ef4444"
}

function PlayerRatingsPanel({ fixtureId }) {
  const { t, i18n } = useTranslation()
  const [teams, setTeams]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiId = String(fixtureId).replace(/^ext-/, "")
    fetch(`/api/v1/fixture_ratings/${apiId}`)
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) && d.length ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fixtureId])

  // Find MOTM: highest-rated player across both teams
  const motmKey = teams ? (() => {
    let best = null, bestVal = -1
    teams.forEach(team => {
      ;(team.players || []).forEach(p => {
        const v = parseFloat(p.rating)
        if (!isNaN(v) && v > bestVal) { bestVal = v; best = `${team.team?.id}-${p.name}` }
      })
    })
    return best
  })() : null

  if (loading) return (
    <div style={{ paddingTop: 16 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="loading-shimmer" style={{ height: 56, borderRadius: 8, marginBottom: 6 }} />
      ))}
    </div>
  )

  if (!teams) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📊</div>
      <h3>{t("match.ratingsEmpty")}</h3>
      <p>{t("match.ratingsAppear")}</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: 8 }}>
      {teams.map((team, ti) => (
        <section key={ti} className="match-section" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <SafeImg src={team.team?.logo} style={{ width: 22, height: 22, objectFit: "contain" }} />
            <h3 className="match-section__title" style={{ margin: 0 }}>{translateTeam(team.team?.name, i18n.language)}</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(team.players || [])
              .sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0))
              .map((p, pi) => {
                const rating  = parseFloat(p.rating)
                const color   = RATING_COLOR(p.rating)
                const isMotm  = motmKey === `${team.team?.id}-${p.name}`
                return (
                  <div key={pi} style={{
                    display: "grid", gridTemplateColumns: "22px 1fr 80px 44px",
                    gap: 8, alignItems: "center",
                    padding: "8px 12px",
                    background: isMotm ? "rgba(245,158,11,.07)" : pi % 2 === 0 ? "transparent" : "var(--surface2)",
                    borderRadius: 6,
                    border: isMotm ? "1px solid rgba(245,158,11,.25)" : "1px solid transparent",
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", textAlign: "center", fontWeight: 700 }}>
                      {p.number ?? ""}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isMotm && <span style={{ marginRight: 4 }} title="Man of the Match">👑</span>}
                        {p.captain ? "©" : ""}{p.name}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                        {p.position ?? ""}{p.minutes ? ` · ${p.minutes}'` : ""}
                        {(p.goals?.total > 0) ? ` ⚽×${p.goals.total}` : ""}
                        {(p.goals?.assists > 0) ? ` 🎯×${p.goals.assists}` : ""}
                        {(p.cards?.yellow > 0) ? " 🟨" : ""}
                        {(p.cards?.red > 0) ? " 🟥" : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {p.passes?.total != null && (
                        <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                          {p.passes.total} pases {p.passes.accuracy != null ? `· ${p.passes.accuracy}%` : ""}
                        </div>
                      )}
                      {p.shots?.total != null && (
                        <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                          {p.shots.total} tiros{p.shots.on != null ? ` (${p.shots.on} a puerta)` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontWeight: 900, fontSize: "1rem", color,
                      textAlign: "right",
                      padding: "4px 8px",
                      background: `${color}18`,
                      borderRadius: 6,
                    }}>
                      {isNaN(rating) ? "–" : rating.toFixed(1)}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ─── Live event feed / commentary ─────────────────────
function LiveCommentaryPanel({ events, homeTeamRaw, homeName, awayName }) {
  const feedItems = [...(events ?? [])]
    .filter(e => e.comments || e.type === "Goal" || e.type === "Card" || e.type === "Var")
    .reverse()

  if (!feedItems.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📝</div>
      <h3>No commentary yet</h3>
    </div>
  )

  const iconFor = (type, detail) => {
    if (type === "Goal")  return detail === "Own Goal" ? "🔴 OG" : "⚽"
    if (type === "Card")  return detail?.includes("Yellow") ? "🟨" : "🟥"
    if (type === "Var")   return "🖥️ VAR"
    if (type === "subst") return "🔄"
    return "📢"
  }

  return (
    <section className="match-section">
      <h3 className="match-section__title" style={{ marginBottom: 12 }}>📝 Match Feed</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feedItems.map((e, i) => {
          const isHome = e.team?.name === homeTeamRaw
          const min    = `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`
          return (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "10px 14px",
              background: "var(--surface2)", borderRadius: 8,
              borderLeft: `3px solid ${e.type === "Goal" ? "#ee1e46" : e.type === "Card" ? "#f59e0b" : "var(--border)"}`,
            }}>
              <div style={{ flexShrink: 0, textAlign: "center", minWidth: 36 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--muted)" }}>{min}</div>
                <div style={{ fontSize: "0.9rem", marginTop: 2 }}>{iconFor(e.type, e.detail)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                  {e.player || e.type} · <span style={{ color: "var(--muted)", fontWeight: 400 }}>{isHome ? homeName : awayName}</span>
                </div>
                {e.comments && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{e.comments}</div>
                )}
                {e.detail && e.detail !== e.type && (
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>{e.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Goal flash toast ──────────────────────────────────
function GoalToast({ text, visible, onDismiss }) {
  if (!visible) return null
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", bottom: "calc(72px + env(safe-area-inset-bottom))",
        left: "50%", transform: "translateX(-50%)",
        background: "#ee1e46", color: "#fff", fontWeight: 800, fontSize: "0.92rem",
        padding: "11px 22px 11px 18px", borderRadius: 40, zIndex: 9999,
        boxShadow: "0 8px 32px rgba(238,30,70,.55)",
        animation: "pageIn .25s ease",
        whiteSpace: "nowrap", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8,
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>⚽</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
      <span style={{ opacity: .6, fontSize: ".75rem", marginLeft: 4 }}>✕</span>
    </div>
  )
}

// ─── Notification event-type preferences ─────────────
const NOTIF_PREF_KEY = "golazo_notif_prefs"
const DEFAULT_PREFS  = { goal: true, kickoff: true, halftime: false, fulltime: true, red_card: false }

// Maps local pref keys → server event_type strings (same names for clarity)
const PUSH_EVENT_MAP = { goal: "goal", kickoff: "kickoff", halftime: "halftime", fulltime: "fulltime", red_card: "red_card" }

function getNotifPrefs() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIF_PREF_KEY) || "{}")
    return { ...DEFAULT_PREFS, ...stored }
  } catch { return { ...DEFAULT_PREFS } }
}
function saveNotifPrefs(prefs) {
  try { localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(prefs)) } catch {}
}
function prefsToServerList(prefs) {
  // Empty list = all events; non-empty = explicit opt-in. Always send the
  // selected subset. If all are checked (or all defaults), send [] to mean "all".
  const selected = Object.entries(PUSH_EVENT_MAP)
    .filter(([k]) => prefs[k])
    .map(([, v]) => v)
  const allSelected = Object.keys(PUSH_EVENT_MAP).every(k => prefs[k])
  return allSelected ? [] : selected
}

function NotifPrefsPanel() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useState(getNotifPrefs)
  const { subscribed, updateEventPrefs } = usePushNotifications()

  const toggle = key => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    saveNotifPrefs(next)
    if (subscribed) updateEventPrefs(prefsToServerList(next))
  }

  const opts = [
    { key: "goal",     label: `⚽ ${t("push.pref.goals",    "Goals")}` },
    { key: "kickoff",  label: `⏰ ${t("push.pref.kickoff",  "Kickoff")}` },
    { key: "halftime", label: `⏸ ${t("push.pref.halftime", "Half-time")}` },
    { key: "fulltime", label: `🏁 ${t("push.pref.fulltime", "Full-time")}` },
    { key: "red_card", label: `🟥 ${t("push.pref.redCard",  "Red cards")}` },
  ]

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 16px", marginBottom: 16,
    }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        🔔 {t("push.pref.title", "Alert preferences")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {opts.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
              border: `1px solid ${prefs[key] ? "rgba(16,185,129,.4)" : "var(--border)"}`,
              background: prefs[key] ? "rgba(16,185,129,.12)" : "var(--surface)",
              color: prefs[key] ? "#10b981" : "var(--muted)",
            }}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Push notification banner for live matches ────────
function LivePushBanner({ homeName, awayName, teamNamesRaw, onDismiss }) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, loading, subscribe, needsIosInstall } = usePushNotifications()
  const [done,   setDone]   = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  if ((!supported && !needsIosInstall) || permission === "denied" || subscribed || done) return null

  const enable = async () => {
    if (needsIosInstall) return
    setErrMsg(null)
    const res = await subscribe((teamNamesRaw || [homeName, awayName]).filter(Boolean))
    if (res.ok) {
      setDone(true)
    } else if (res.error === "Permission denied") {
      setDone(true)
    } else {
      setErrMsg(res.error || t("push.error"))
    }
  }

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid rgba(238,30,70,.3)",
      borderRadius: 10, padding: "12px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "1.2rem" }}>{needsIosInstall ? "📲" : "🔔"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "0.82rem", color: "var(--text)" }}>
          {needsIosInstall ? t("push.iosHint") : t("push.getAlertsWhenClosed")}
        </span>
        {errMsg && (
          <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: 4 }}>⚠ {errMsg}</div>
        )}
      </div>
      {!needsIosInstall && (
        <button onClick={enable} disabled={loading} style={{
          background: "#ee1e46", color: "#fff", border: "none", borderRadius: 6,
          padding: "6px 14px", fontWeight: 700, fontSize: "0.8rem",
          cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "…" : errMsg ? t("push.retry") : t("push.allow")}
        </button>
      )}
      <button onClick={onDismiss} style={{
        background: "none", color: "var(--muted)", border: "none", cursor: "pointer", fontSize: "0.8rem",
      }}>{t("push.notNow")}</button>
    </div>
  )
}

// ─── Skeleton loader ───────────────────────────────────
function MatchSkeleton() {
  return (
    <div>
      {/* Scoreboard skeleton */}
      <div style={{ background: "#0d1117", padding: "48px 0 36px" }}>
        <div className="container" style={{ maxWidth: 700 }}>
          <div className="loading-shimmer" style={{ height: 16, width: 160, borderRadius: 6, margin: "0 auto 28px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div className="loading-shimmer" style={{ width: 80, height: 80, borderRadius: "50%" }} />
              <div className="loading-shimmer" style={{ width: 100, height: 14, borderRadius: 6 }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div className="loading-shimmer" style={{ width: 120, height: 52, borderRadius: 8, margin: "0 auto 10px" }} />
              <div className="loading-shimmer" style={{ width: 60, height: 12, borderRadius: 4, margin: "0 auto" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div className="loading-shimmer" style={{ width: 80, height: 80, borderRadius: "50%" }} />
              <div className="loading-shimmer" style={{ width: 100, height: 14, borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div className="container" style={{ maxWidth: 700, paddingTop: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="loading-shimmer" style={{ height: 18, borderRadius: 6, marginBottom: 14, width: `${90 - i * 10}%` }} />
        ))}
      </div>
    </div>
  )
}

// ─── Related News ──────────────────────────────────────

function relativeTime(published_at) {
  if (!published_at) return ""
  const diff = Math.floor((Date.now() - new Date(published_at).getTime()) / 1000)
  if (diff <= 0)    return "< 1m"
  if (diff < 60)    return `${diff}s`
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} d`
}

// Leagues whose names are specific enough to improve article matching.
// Generic values like "Friendlies", "World Cup" flood results or match nothing.
const NEWS_SEARCHABLE_LEAGUES = new Set([
  "premier league", "la liga", "serie a", "bundesliga", "ligue 1",
  "eredivisie", "primeira liga", "champions league", "europa league",
  "conference league", "copa del rey", "fa cup", "carabao cup",
  "mls", "copa america", "euros", "nations league", "libertadores",
])

function RelatedNewsPanel({ homeName, awayName, leagueName, lang, t }) {
  const [articles, setArticles] = useState([])

  useEffect(() => {
    if (!homeName && !awayName) return

    // Build keyword list — only include league when it's specific enough
    const leagueWords = leagueName &&
      NEWS_SEARCHABLE_LEAGUES.has(leagueName.toLowerCase().trim())
        ? leagueName.toLowerCase().split(/[\s\-\/]+/).filter(k => k.length > 3)
        : []
    const GENERIC = new Set(["real", "city", "club", "united", "atletico", "atleticó"])
    const words = [...[homeName, awayName]
      .filter(Boolean)
      .flatMap(n => n.toLowerCase().split(/[\s\-\/]+/))
      .filter(k => k.length > 3 && !GENERIC.has(k)),
      ...leagueWords,
    ]
    if (words.length === 0) return

    // Send keywords server-side — avoids fetching 60 articles to filter 3
    const q = encodeURIComponent(words.join(","))
    const controller = new AbortController()
    fetch(`/api/v1/news?lang=${lang}&q=${q}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : [])
      .then(items => { if (Array.isArray(items) && items.length > 0) setArticles(items) })
      .catch(() => {})
    return () => controller.abort()
  }, [homeName, awayName, leagueName, lang])

  if (articles.length === 0) return null

  return (
    <section className="related-news">
      <div className="related-news__header">
        <h3 className="related-news__title">{t("match.relatedNews")}</h3>
        <Link to="/news" className="related-news__more">{t("news.seeMore")}</Link>
      </div>
      <div className="related-news__scroll">
        {articles.map(a => {
          const color = sourceColor(a.source)
          return (
            <Link key={a.id} to={`/news/${a.id}`} className="rn-card">
              {a.image
                ? <div className="rn-card__img" style={{ backgroundImage: `url(${a.image})` }} />
                : <div className="rn-card__img rn-card__img--placeholder" />
              }
              <div className="rn-card__body">
                <span className="rn-card__tag" style={{ background: color }}>{a.source}</span>
                <p className="rn-card__title">{a.title}</p>
                <div className="rn-card__footer">
                  <div className="rn-card__source-dot" style={{ background: color }} />
                  <span className="rn-card__time">{relativeTime(a.published_at)}</span>
                  <span className="rn-card__bookmark">🔖</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ─── Main Page ─────────────────────────────────────────
// TAB_KEYS is built dynamically in the component based on match status

// Converts a list-match preview (from router state) into the fixture shape
// MatchShowPage expects, so the scoreboard renders before the API responds.
function previewToFixture(m) {
  if (!m) return null
  const short = m.status === "finished" ? "FT" : m.status === "live" ? "1H" : "NS"
  return {
    fixture: {
      fixture: { id: m.external_id, date: m.kickoff_at, status: { short, long: short, elapsed: m.minute }, venue: {} },
      league:  { id: m.competition?.id, name: m.competition?.name, logo: m.competition?.logo, country: m.competition?.country, round: null },
      teams: {
        home: { id: null, name: m.home_team?.name, logo: m.home_team?.flag_url, winner: null },
        away: { id: null, name: m.away_team?.name, logo: m.away_team?.flag_url, winner: null },
      },
      goals: { home: m.home_score, away: m.away_score },
    },
    events: [], stats: [], lineups: [],
  }
}

export default function MatchShowPage() {
  const { t, i18n } = useTranslation()
  const { id }      = useParams()
  const navigate    = useNavigate()
  const location    = useLocation()
  const preview     = location.state?.preview
  // Seed from the prefetch cache (warmed on row hover/tap) for an instant paint;
  // fall back to the list preview, then to a skeleton while the fetch runs.
  const [data, setData]         = useState(() => getCachedMatchDetail(id) || previewToFixture(preview))
  const [loading, setLoading]   = useState(() => !getCachedMatchDetail(id))
  const [tab, setTab]           = useState("summary")
  const [toast, setToast]       = useState(null)
  const [showNotifBanner, setShowNotifBanner] = useState(false)
  const [aiSummary, setAiSummary]   = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState(false)
  const aiRequestedRef              = useRef(false)
  const toastQueue    = useRef([])   // queue so rapid goals don't cut each other short
  const toastTimer    = useRef(null)
  const swipeStartX   = useRef(null)
  const swipeStartY   = useRef(null)
  const dataFetchedAt = useRef(0)    // timestamp of the most recent data update (poll or WS)

  // Detect if live
  const statusShort = data?.fixture?.fixture?.status?.short
  const isLive      = ["1H", "2H", "HT", "ET", "BT", "P", "INT"].includes(statusShort)
  const apiMinute   = data?.fixture?.fixture?.status?.elapsed
  const apiExtra    = data?.fixture?.fixture?.status?.extra
  const liveMinute  = useLiveMinute(apiMinute, isLive)

  const homeTeamRaw = data?.fixture?.teams?.home?.name  // raw API name for event comparisons
  const awayTeamRaw = data?.fixture?.teams?.away?.name
  const homeName    = translateTeam(homeTeamRaw, i18n.language)
  const awayName    = translateTeam(awayTeamRaw, i18n.language)
  const kickoffAt   = data?.fixture?.fixture?.date
  const homeLogo    = data?.fixture?.teams?.home?.logo

  // Prev / next match navigation
  // Primary: injected by TodayPage via router state (in-app nav)
  // Fallback: fetch same-day matches when arriving via deep link (direct URL)
  const [fallbackList, setFallbackList] = useState([])
  const [fallbackIdx,  setFallbackIdx]  = useState(-1)

  const stateList = location.state?.matchList ?? []
  const stateIdx  = location.state?.matchIdx  ?? -1
  const matchList = stateList.length > 0 ? stateList : fallbackList
  const matchIdx  = stateList.length > 0 ? stateIdx  : fallbackIdx

  // When arriving via deep link (no state), build a list from the same day's schedule
  useEffect(() => {
    if (stateList.length > 0 || !kickoffAt) return          // already have list
    const date = kickoffAt.slice(0, 10)                      // "YYYY-MM-DD"
    fetch(`/api/v1/today?date=${date}`)
      .then(r => r.ok ? r.json() : [])
      .then(items => {
        if (!Array.isArray(items) || items.length === 0) return
        const idx = items.findIndex(m => String(m.external_id) === String(id))
        if (idx === -1) return
        setFallbackList(items)
        setFallbackIdx(idx)
      })
      .catch(() => {})
  }, [kickoffAt, stateList.length, id])

  const prevMatchNav = matchIdx > 0                    ? matchList[matchIdx - 1] : null
  const nextMatchNav = matchIdx < matchList.length - 1 ? matchList[matchIdx + 1] : null
  usePageMeta(
    homeName && awayName ? `${homeName} vs ${awayName}` : "Match",
    homeName && awayName
      ? `${homeName} vs ${awayName} live score, match stats, lineups and events — FIFA World Cup 2026.`
      : undefined,
    { type: "article", image: homeLogo || undefined }
  )
  const homeScore = data?.fixture?.goals?.home
  const awayScore = data?.fixture?.goals?.away
  useStructuredData(homeName && awayName ? {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${homeName} vs ${awayName}`,
    "description": `FIFA World Cup 2026 match: ${homeName} vs ${awayName}`,
    "startDate": kickoffAt,
    "sport": "Soccer",
    "homeTeam": { "@type": "SportsTeam", "name": homeName },
    "awayTeam": { "@type": "SportsTeam", "name": awayName },
    ...(homeScore != null && awayScore != null ? {
      "homeScore": homeScore,
      "awayScore": awayScore,
    } : {}),
    "url": typeof window !== "undefined" ? window.location.href : undefined,
  } : null)
  const homeTeamId  = data?.fixture?.teams?.home?.id
  const awayTeamId  = data?.fixture?.teams?.away?.id

  function showToast(msg) {
    toastQueue.current.push(msg)
    if (toastTimer.current) return  // already processing; new item will be shown after current
    function processNext() {
      const next = toastQueue.current.shift()
      if (!next) { setToast(null); return }
      setToast(next)
      toastTimer.current = setTimeout(() => {
        toastTimer.current = null
        processNext()
      }, 4000)
    }
    processNext()
  }

  // Goal notification logic
  const prevGoalsRef = useRef({ h: null, a: null })
  function checkGoals(goals, events) {
    const h = goals?.home
    const a = goals?.away
    const prev = prevGoalsRef.current
    if (prev.h !== null && (h > prev.h || a > prev.a)) {
      const scorer = [...(events || [])].reverse().find(e => e.type === "Goal")
      const name = scorer?.player ? `⚽ ${scorer.player}` : "⚽ GOAL!"
      showToast(name)

      // NOTE: Do NOT use `new Notification()` here — it is blocked in the
      // main thread on iOS (both Safari and PWA) and unreliable on Android.
      // Foreground alerts are handled by the in-app toast above.
      // Background/closed-app alerts are handled by server-side VAPID push
      // via the service worker — no duplicate notification needed here.
    }
    prevGoalsRef.current = { h, a }
  }

  // Poll for data — guards against a stale response overwriting fresher WS data.
  // We capture fetchStarted *before* the network round-trip; if a WS message
  // arrived after this poll started (dataFetchedAt > fetchStarted), the poll
  // result is by definition staler and gets discarded.
  const load = useCallback(() => {
    // Guard: don't fetch if id looks invalid (undefined, null, object-stringified)
    if (!id || id === "undefined" || id === "null" || id.includes("object")) {
      return Promise.resolve()
    }
    const fetchStarted = Date.now()
    return fetchWithTimeout(`/api/v1/match_detail/${id}`, 10000)
      .then(r => r.json())
      .then(d => {
        if (d?.fixture) setCachedMatchDetail(id, d)
        setData(prev => {
          if (fetchStarted < dataFetchedAt.current) return prev  // WS beat us — keep fresher data
          dataFetchedAt.current = fetchStarted
          if (prev && isLive) checkGoals(d.fixture?.goals, d.events)
          return d
        })
      })
      .catch(() => {})
  }, [id])

  useEffect(() => {
    // When navigating to an already-prefetched match, swap in cached data and
    // skip the skeleton; otherwise show the skeleton until the fetch resolves.
    const cached = getCachedMatchDetail(id)
    if (cached) { setData(cached); setLoading(false) } else { setLoading(true) }
    load().finally(() => setLoading(false))
  }, [id])

  // Adaptive polling: 20s when live, 60s otherwise. Paused while the tab is
  // hidden — match_detail is the heaviest endpoint (external API call + DB
  // writes + ActionCable broadcasts on every hit), so a backgrounded tab must
  // not keep hammering it.
  useVisiblePolling(load, isLive ? 20000 : 60000, [id])

  // ActionCable subscription — push updates when live.
  // Stamps dataFetchedAt so concurrent polls know this data is the freshest.
  const handleCableMessage = useCallback((msg) => {
    if (msg.type === "match_update" && msg.fixture) {
      dataFetchedAt.current = Date.now()
      setData(prev => {
        if (prev) checkGoals(msg.fixture?.goals, msg.events)
        return { fixture: msg.fixture, events: msg.events, stats: msg.stats, lineups: msg.lineups }
      })
    } else if (msg.type === "score_update" || (msg.type === "match_update" && !msg.fixture)) {
      // Lightweight score-only update (broadcast from WorldCupSync) — patch existing data
      dataFetchedAt.current = Date.now()
      setData(prev => {
        if (!prev?.fixture) return prev
        const updated = {
          ...prev,
          fixture: {
            ...prev.fixture,
            goals: { home: msg.home_score, away: msg.away_score },
            fixture: {
              ...prev.fixture.fixture,
              status: {
                ...prev.fixture.fixture?.status,
                short:   msg.status === "live" ? (prev.fixture.fixture?.status?.short || "1H") : msg.status,
                elapsed: msg.minute,
              },
            },
          },
        }
        checkGoals(updated.fixture.goals, prev.events)
        return updated
      })
    }
  }, [])

  useExternalMatchChannel(isLive ? id : null, handleCableMessage)

  // Show push banner on live matches when not yet granted
  useEffect(() => {
    if (!isLive) return
    if (typeof Notification === "undefined") return
    if (Notification.permission === "default") setShowNotifBanner(true)
  }, [isLive])

  // Fetch AI summary for finished matches — fires once per mount via ref guard.
  // aiLoading intentionally excluded from deps: setting it would re-trigger the
  // effect before the in-flight request completes (especially in StrictMode).
  useEffect(() => {
    if (!data?.fixture) return
    const status = data?.fixture?.fixture?.status?.short
    const isFinished = ["FT", "AET", "PEN"].includes(status)
    if (!isFinished || aiSummary || aiError || aiRequestedRef.current) return

    aiRequestedRef.current = true
    const lang       = i18n.language?.slice(0, 2) || "en"
    const matchDbId  = data?.fixture?.fixture?.localId || data?.fixture?.fixture?.db_id
    const summaryUrl = matchDbId
      ? `/api/v1/matches/${matchDbId}/ai_summary?lang=${lang}`
      : `/api/v1/match_detail/${id}/ai_summary?lang=${lang}`

    const controller = new AbortController()
    setAiLoading(true)
    fetch(summaryUrl, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(r.status)
        return r.json()
      })
      .then(d => {
        if (d.summary) setAiSummary(d)
        else setAiError(true)
      })
      .catch(err => { if (err.name !== "AbortError") setAiError(true) })
      .finally(() => setAiLoading(false))
    return () => controller.abort()
  }, [data?.fixture?.fixture?.status?.short, aiSummary, aiError]) // eslint-disable-line

  // Auto-select "preview" tab for pre-kickoff matches on first load
  useEffect(() => {
    if (!loading && statusShort && ["NS", "TBD"].includes(statusShort) && tab === "summary") {
      setTab("preview")
    }
  }, [loading, statusShort]) // eslint-disable-line

  // usePushNotifications must be called unconditionally (Rules of Hooks) — before any early return.
  const notifSupported = typeof Notification !== "undefined" && "PushManager" in window
  const { subscribed: pushSubscribed, addTeams, teamsSubscribed } = usePushNotifications()
  const matchTeamsNotified = teamsSubscribed([homeTeamRaw, awayTeamRaw].filter(Boolean))

  // Back navigation
  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate("/scores/today")
  }

  if (loading) return <MatchSkeleton />

  const hasFixture  = !!data?.fixture
  const isApiError  = !hasFixture && data?.error === "api_error"

  const eventCount  = data?.events?.filter(e => ["Goal","Card","subst","Var","injury"].includes(e.type)).length ?? 0

  const hasStats    = data?.stats?.length > 0
  const hasLineups  = data?.lineups?.some(l => l?.start_xi?.length > 0)
  const hasH2H      = data?.h2h?.matches?.length > 0
  const hasEvents   = eventCount > 0
  const goalCount   = data?.events?.filter(e => e.type === "Goal").length ?? 0
  const isNS        = statusShort === "NS" || statusShort === "TBD"
  const isFinished  = ["FT", "AET", "PEN"].includes(statusShort)
  const hasCommentary = (data?.events ?? []).some(e => e.comments)
  // Dynamic tab list — "preview" prepended for pre-kickoff; "ratings"/"feed" for live/finished
  const TAB_KEYS    = [
    ...(isNS ? ["preview"] : []),
    "summary",
    ...(isNS ? [] : ["stats"]),
    "lineups",
    "h2h",
    ...((isLive || isFinished) ? ["ratings"] : []),
    ...((isLive || isFinished) && hasCommentary ? ["feed"] : []),
  ]
  const TAB_LABELS  = { preview: t("match.preview"), summary: t("match.summary"), stats: t("match.stats"), lineups: t("match.lineups"), h2h: t("match.h2h"), ratings: t("match.ratings"), feed: t("match.feed") }
  const TABS        = TAB_KEYS.map(k => ({ key: k, label: TAB_LABELS[k] ?? k }))

  // Swipe between tabs — only on horizontal-dominant gestures
  function handleTabSwipeStart(e) {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
  }
  function handleTabSwipeEnd(e) {
    if (swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    const dy = e.changedTouches[0].clientY - (swipeStartY.current ?? 0)
    swipeStartX.current = null
    // Ignore if vertical scroll is dominant (prevents page-scroll conflict)
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 60) return
    const idx = TAB_KEYS.indexOf(tab)
    if (dx < 0 && idx < TAB_KEYS.length - 1) setTab(TAB_KEYS[idx + 1])
    else if (dx > 0 && idx > 0)              setTab(TAB_KEYS[idx - 1])
  }

  return (
    <div>
      <GoalToast text={toast} visible={!!toast} onDismiss={() => setToast(null)} />

      {/* Back bar — visible on mobile above scoreboard */}
      <div className="match-back-bar">
        <div className="container" style={{ maxWidth: 740, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button onClick={goBack} className="btn-back" style={{ padding: "10px 0", flexShrink: 0 }}>← {t("nav.back")}</button>

          {/* Prev / next match navigation */}
          {(prevMatchNav || nextMatchNav) && (
            <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
              {prevMatchNav && (
                <button
                  onClick={() => navigate(`/matches/${String(prevMatchNav.external_id)}`, { state: { matchList, matchIdx: matchIdx - 1 } })}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "8px 14px", fontSize: "0.68rem",
                    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    minHeight: 44,
                  }}
                  title={`${prevMatchNav.home_team?.name} vs ${prevMatchNav.away_team?.name}`}
                >
                  ← {translateTeam(prevMatchNav.home_team?.name, i18n.language)?.split(" ")?.[0]}
                </button>
              )}
              {nextMatchNav && (
                <button
                  onClick={() => navigate(`/matches/${String(nextMatchNav.external_id)}`, { state: { matchList, matchIdx: matchIdx + 1 } })}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "8px 14px", fontSize: "0.68rem",
                    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                    minHeight: 44,
                  }}
                  title={`${nextMatchNav.home_team?.name} vs ${nextMatchNav.away_team?.name}`}
                >
                  {translateTeam(nextMatchNav.home_team?.name, i18n.language)?.split(" ")?.[0]} →
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {isLive && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.7rem", color: "var(--muted)" }}>
                <span className="live-dot" /> {t("match.updatingEvery")}
              </span>
            )}
            {!isLive && <ReminderButton match={data?.fixture ? { ...data.fixture.fixture, home_team: data.fixture.teams?.home, away_team: data.fixture.teams?.away, kickoff_at: data.fixture.fixture?.date, external_id: id } : null} />}
            <ShareButton homeName={homeName} awayName={awayName} />
          </div>
        </div>
      </div>

      {/* Scoreboard — renders from fixture data or a minimal shell */}
      {hasFixture
        ? (
          <Scoreboard
            fixture={data.fixture}
            isLive={isLive}
            liveMinute={liveMinute}
            liveExtra={apiExtra}
            matchId={id}
            notifEnabled={notifSupported && pushSubscribed && matchTeamsNotified}
            notifSupported={notifSupported}
            onNotif={() => pushSubscribed && addTeams([homeTeamRaw, awayTeamRaw].filter(Boolean))}
            events={data.events}
          />
        ) : (
          <div style={{ background: "var(--surface1,#0d1117)", padding: "48px 0 36px" }}>
            <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12, opacity: .3 }}>⚽</div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                {isApiError ? t("error.dataUnavailable") : t("error.notFound")}
              </div>
            </div>
          </div>
        )
      }

      {/* Tab bar — always visible */}
      <div className="tab-bar sticky-tabs">
        <div className="container" style={{ maxWidth: 740 }}>
          <div className="tab-bar__inner">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                className={`tab-link${tab === key ? " tab-link--active" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
                {key === "summary" && eventCount > 0 && (
                  <span className="tab-count">{eventCount}</span>
                )}
                {((key === "stats" && hasStats) || (key === "lineups" && hasLineups) || (key === "h2h" && hasH2H)) && (
                  <span className="tab-dot" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 740, paddingTop: 20, paddingBottom: 40 }}>
        {/* Retry button — only shown when fixture failed to load */}
        {!hasFixture && (
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <button
              onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}
              style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 16px", fontWeight: 700,
                fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              {t("error.retry")}
            </button>
          </div>
        )}

        {/* Live push notification banner */}
        {showNotifBanner && isLive && (
          <LivePushBanner
            homeName={homeName}
            awayName={awayName}
            teamNamesRaw={[homeTeamRaw, awayTeamRaw].filter(Boolean)}
            onDismiss={() => setShowNotifBanner(false)}
          />
        )}
        {isLive && notifSupported && Notification.permission === "granted" && (
          <NotifPrefsPanel />
        )}

        {/* Score timeline — replaces goal banner with visual progression */}
        {goalCount > 0 && (
          <ScoreTimeline
            events={data.events}
            homeTeamRaw={homeTeamRaw}
            homeName={homeName}
            awayName={awayName}
            t={t}
          />
        )}

        {/* Tab content — swipeable on mobile */}
        <div onTouchStart={handleTabSwipeStart} onTouchEnd={handleTabSwipeEnd}>

        {tab === "preview" && (
          <>
            {hasFixture && isNS && (
              <ScorePredictionPanel matchId={id} homeName={homeName} awayName={awayName} matchStatus={statusShort} kickoffAt={kickoffAt} t={t} />
            )}
            <MatchPreviewPanel
              fixtureId={id}
              homeName={homeName}
              awayName={awayName}
              t={t}
            />
          </>
        )}

        {tab === "summary" && (
          <>
            {/* Reactions — always shown; compact for live matches */}
            <div className="match-section" style={{ marginBottom: 12 }}>
              <MatchReactions matchId={id} compact={["1H","HT","2H","ET","BT","P"].includes(statusShort)} />
            </div>

            {hasFixture && <ScorePredictionPanel matchId={id} homeName={homeName} awayName={awayName} matchStatus={statusShort} kickoffAt={kickoffAt} t={t} />}

            {/* AI Match Summary — shown after full time */}
            {["FT","AET","PEN"].includes(statusShort) && (
              <section className="match-section" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <h3 className="match-section__title" style={{ margin: 0 }}>{t("match.aiMatchReport")}</h3>
                  <span style={{ fontSize: "0.62rem", background: "rgba(99,102,241,.15)", color: "#818cf8", padding: "2px 7px", borderRadius: 10, fontWeight: 700 }}>AI</span>
                </div>
                {aiLoading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--muted)", fontSize: "0.84rem" }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    {t("match.generating")}
                  </div>
                )}
                {aiSummary?.summary && (
                  <div>
                    <p style={{ lineHeight: 1.65, color: "var(--text)", fontSize: "0.88rem", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                      {aiSummary.summary}
                    </p>
                    <div style={{ fontSize: "0.62rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                      <span>✨</span>
                      <span>{t("match.aiGeneratedBy")} · {aiSummary.generated_at ? new Date(aiSummary.generated_at).toLocaleDateString() : ""}</span>
                    </div>
                  </div>
                )}
                {!aiLoading && !aiSummary && !aiError && (
                  <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    {t("match.reportSoon")}
                  </p>
                )}
              </section>
            )}

            {/* Mini stats snapshot — possession + shots at a glance */}
            {hasStats && statusShort !== "NS" && (
              <MiniStatsBar stats={data.stats} homeName={homeName} awayName={awayName} />
            )}

            {hasEvents
              ? <EventsTimeline events={data.events} homeTeam={homeTeamRaw ?? homeName} awayTeam={awayTeamRaw ?? awayName} statusShort={statusShort} t={t} i18n={i18n} />
              : (
                <div className="empty-state">
                  <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: .3 }}>🏟️</div>
                  <h3>{statusShort === "NS" ? t("match.notStarted") : t("match.noEvents")}</h3>
                  <p style={{ maxWidth: 260 }}>
                    {statusShort === "NS" ? t("match.eventsAppear") : t("match.eventsUnavailable")}
                  </p>
                </div>
              )
            }
          </>
        )}

        {tab === "stats" && (
          <StatsPanel stats={data?.stats} home={data?.fixture?.teams?.home} away={data?.fixture?.teams?.away} t={t} statusShort={statusShort} />
        )}

        {tab === "lineups" && <LineupsPanel lineups={data?.lineups} fixtureId={id} t={t} statusShort={statusShort} />}

        {tab === "h2h" && (
          <H2HPanel h2h={data?.h2h} homeTeamName={homeName} awayTeamName={awayName} t={t} lang={i18n.language} />
        )}

        {tab === "ratings" && (
          <PlayerRatingsPanel fixtureId={id} />
        )}

        {tab === "feed" && (
          <LiveCommentaryPanel events={data?.events} homeTeamRaw={homeTeamRaw} homeName={homeName} awayName={awayName} />
        )}

        {/* Related News — shown on every tab when fixture is loaded */}
        {hasFixture && (
          <RelatedNewsPanel
            homeName={homeName}
            awayName={awayName}
            leagueName={data?.fixture?.league?.name}
            lang={i18n.language?.slice(0, 2) || "en"}
            t={t}
          />
        )}
        </div>
      </div>
    </div>
  )
}
