import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../i18n/leagueNames"
import { translateTeam } from "../i18n/teamNames"
import { useExternalMatchChannel } from "../hooks/useExternalMatchChannel"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { useLiveMinute, useGoalNotifications } from "./match/useMatchLive"
import PredictionPanel from "./match/PredictionPanel"
import ScorePredictionPanel from "./match/ScorePredictionPanel"
import MatchReactions from "../components/MatchReactions"
import { useReminders } from "../hooks/useReminders"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { getMatchColor } from "../utils/teamColors"
import { sourceColor } from "../utils/sourceColors"
import { storageGet, storageSet } from "../utils/safeStorage"

// ─── Reminder button ──────────────────────────────────
function ReminderButton({ match }) {
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

  return (
    <button
      onClick={toggle}
      title={reminded ? "Remove reminder" : "Remind me at kickoff"}
      style={{
        background: reminded ? "rgba(16,185,129,.15)" : "none",
        border: reminded ? "1px solid rgba(16,185,129,.4)" : "none",
        borderRadius: 6, cursor: "pointer",
        color: reminded ? "#10b981" : "var(--muted)",
        fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4,
        padding: "5px 8px", transition: "all .2s",
      }}
    >
      {reminded ? "🔔 Set" : "🔕 Remind"}
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

// ─── Score timeline (goal progression at a glance) ────
function ScoreTimeline({ events, homeTeamRaw, homeName, awayName, t }) {
  const goals = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
  if (!goals.length) return null

  let h = 0, a = 0
  const moments = goals.map(e => {
    const forHome = e.team?.name === homeTeamRaw
    if (forHome) h++; else a++
    return {
      min:     `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`,
      player:  e.player,
      isHome:  forHome,
      isOG:    e.detail === "Own Goal",
      isP:     e.detail === "Penalty",
      score:   `${h}–${a}`,
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
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>
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
              textAlign: "center", fontWeight: 900, fontSize: "0.85rem", color: "#fff",
              background: "var(--surface2)", borderRadius: 6, padding: "4px 6px",
              border: "1px solid var(--border)", flexShrink: 0,
            }}>
              {m.score}
            </div>
            {/* Away side */}
            <div>
              {!m.isHome && (
                <div style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff" }}>
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
        <span style={{ color: "var(--muted)", fontSize: "0.62rem" }}>STATS SNAPSHOT</span>
        <span style={{ color: "#3b82f6" }}>{awayName}</span>
      </div>

      {/* Possession bar */}
      {possession && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: "#fff" }}>{homePoss}%</span>
            <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>Possession</span>
            <span style={{ fontWeight: 700, color: "#fff" }}>{awayPoss}%</span>
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
          <span style={{ fontWeight: 700, color: "#fff" }}>{totalShots[0] ?? 0}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>Shots {onTarget[0] !== undefined ? `(${onTarget[0] ?? 0} / ${onTarget[1] ?? 0} on target)` : ""}</span>
          <span style={{ fontWeight: 700, color: "#fff" }}>{totalShots[1] ?? 0}</span>
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

function Scoreboard({ fixture, isLive, liveMinute, matchId, onShare, onNotif, notifEnabled, notifSupported, events }) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)
  const home   = fixture?.teams?.home
  const away   = fixture?.teams?.away
  const homeName = translateTeam(home?.name, i18n.language)
  const awayName = translateTeam(away?.name, i18n.language)
  const homeRaw  = home?.name   // raw API name for event comparison
  const teamColor = getMatchColor(home?.name, away?.name)
  const goals  = fixture?.goals
  const status = fixture?.fixture?.status
  const isNS   = status?.short === "NS"
  const isFT   = status?.short === "FT" || status?.short === "AET" || status?.short === "PEN"
  const isHT   = status?.short === "HT"

  function share() {
    const hs   = goals?.home ?? "?"
    const as   = goals?.away ?? "?"
    let text   = isLive
      ? `🔴 LIVE: ${homeName} ${hs}–${as} ${awayName}`
      : `${homeName} ${hs}–${as} ${awayName}`

    // Append goal scorers for richer shares
    const goalEvents = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
    if (goalEvents.length > 0) {
      const homeGoals = goalEvents.filter(e => e.team?.name === homeRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
      const awayGoals = goalEvents.filter(e => e.team?.name !== homeRaw).map(e => `${e.player} ${e.minute}'`).join(", ")
      const scorerLine = [homeGoals, awayGoals].filter(Boolean).join(" | ")
      if (scorerLine) text += `\n⚽ ${scorerLine}`
    }
    text += `\n${window.location.href}`

    const fallback = () => {
      try {
        const ta = document.createElement("textarea")
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"
        document.body.appendChild(ta); ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      } catch {}
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.share && !navigator.userAgentData?.mobile) {
      // Use native share on mobile
      navigator.share({ title: `${homeName} vs ${awayName}`, text, url: window.location.href }).catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(fallback)
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
    <div className="scoreboard" style={teamColor ? { "--team-color": teamColor, "--team-color-dim": `${teamColor}22` } : {}}>
      <div className="scoreboard__half scoreboard__half--home" style={teamColor ? { background: `linear-gradient(135deg, ${teamColor}18 0%, transparent 70%)` } : {}} />
      <div className="scoreboard__half scoreboard__half--away" />

      <div className="container scoreboard__inner" style={{ maxWidth: 740 }}>

        {/* Competition row */}
        <div className="scoreboard__competition">
          {fixture?.league?.logo && (
            <img src={fixture.league.logo} alt="" style={{ width: 18, height: 18, objectFit: "contain" }}
              onError={e => (e.target.style.display = "none")} />
          )}
          <span>{translateLeague(fixture?.league?.name, i18n.language)}</span>
          {fixture?.league?.round && (
            <span className="scoreboard__round">{fixture.league.round}</span>
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
              {liveMinute ? `${liveMinute}'` : "LIVE"}
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
            <div className={`scoreboard__team-name${home?.winner ? " scoreboard__team-name--winner" : ""}`}>
              {homeName}
            </div>
          </div>

          <div className="scoreboard__score-block">
            <div className="scoreboard__score" style={{ gap: 12 }}>
              <span style={{ color: home?.winner ? "#10b981" : "#fff" }}>{goals?.home ?? (isNS ? "–" : "0")}</span>
              <span className="scoreboard__score-sep">:</span>
              <span style={{ color: away?.winner ? "#10b981" : "#fff" }}>{goals?.away ?? (isNS ? "–" : "0")}</span>
            </div>
            {home?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "#10b981" }}>
                {homeName} WIN
              </div>
            )}
            {away?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "#10b981" }}>
                {awayName} WIN
              </div>
            )}
          </div>

          <div className="scoreboard__team scoreboard__team--away">
            <FlagOrInitials name={away?.name} src={away?.logo} size={76} />
            <div className={`scoreboard__team-name${away?.winner ? " scoreboard__team-name--winner" : ""}`}>
              {awayName}
            </div>
          </div>
        </div>

        {/* Footer: venue + share + notif */}
        <div className="scoreboard__footer">
          {fixture?.fixture?.venue?.name && (
            <span className="scoreboard__venue">
              📍 {fixture.fixture.venue.name}
              {fixture.fixture.venue.city ? `, ${fixture.fixture.venue.city}` : ""}
            </span>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isLive && notifSupported && (
              <button
                onClick={onNotif}
                title={notifEnabled ? "Notifications on" : "Get goal alerts"}
                style={{
                  background: notifEnabled ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.08)",
                  border: notifEnabled ? "1px solid rgba(16,185,129,.4)" : "1px solid rgba(255,255,255,.15)",
                  borderRadius: 20, padding: "5px 12px",
                  color: notifEnabled ? "#10b981" : "rgba(255,255,255,.5)",
                  fontSize: ".72rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                {notifEnabled ? "🔔 On" : "🔔 Alerts"}
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

function EventsTimeline({ events, homeTeam, awayTeam, statusShort, t }) {
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

  regularEvents.forEach(e => {
    const min = e.minute ?? 0
    if (!htInserted && min > 45) {
      items.push({ _divider: t("match.htDivider") })
      htInserted = true
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

          const isHome    = e.team?.name === homeTeam
          const isGoal    = e.type === "Goal" && e.detail !== "Missed Penalty"
          const isMissed  = e.type === "Goal" && e.detail === "Missed Penalty"
          const isSub     = e.type === "subst"
          const isVar     = e.type === "Var"
          const isCard    = e.type === "Card"
          const minuteStr = `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`
          const varCancelled = isVar && (e.detail?.toLowerCase().includes("cancel") || e.detail?.toLowerCase().includes("disallow"))

          return (
            <div key={i}
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
                  <span className="match-event__assist" style={{ color: "#ef4444" }}> missed penalty</span>
                )}
              </div>
              {!isSub && !isVar && (
                <span className="match-event__team" style={{ textAlign: isHome ? "right" : "left", fontSize: "0.68rem", color: "var(--muted)" }}>
                  {e.team?.name}
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
                    <span className="match-event__player" style={{ color: scored ? "#fff" : "var(--muted)" }}>
                      {e.player}
                    </span>
                    <span className="match-event__assist" style={{ color: scored ? "#10b981" : "#ef4444" }}>
                      {scored ? " scored" : " missed"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "#fff", minWidth: 36, textAlign: isHome ? "right" : "left" }}>
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

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.8rem" }}>
        <span style={{ fontWeight: 700, color: "#fff" }}>{homeVal ?? 0}{isPct ? "%" : ""}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "#fff" }}>{awayVal ?? 0}{isPct ? "%" : ""}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
        <div style={{ width: `${homePct}%`, background: "#ee1e46", transition: "width .4s" }} />
        <div style={{ flex: 1, background: "#3b82f6" }} />
      </div>
    </div>
  )
}

function StatsPanel({ stats, home, away, t, statusShort }) {
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
          {home?.logo && <img src={home.logo} alt="" className="logo-sm" onError={e => (e.target.style.display = "none")} />}
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ee1e46" }}>{home?.name}</span>
        </div>
        <h3 className="match-section__title" style={{ margin: 0 }}>{t("match.statistics")}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#3b82f6" }}>{away?.name}</span>
          {away?.logo && <img src={away.logo} alt="" className="logo-sm" onError={e => (e.target.style.display = "none")} />}
        </div>
      </div>
      {pairs.map(({ type, h, a }) => (
        <StatBar key={type} label={type} homeVal={h} awayVal={a} isPct={String(h).includes("%")} />
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
  const { t } = useTranslation()
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
        {team.team?.logo && (
          <img src={team.team.logo} alt="" className="logo-sm" onError={e => (e.target.style.display = "none")} />
        )}
        <div>
          <div className="lineup-team__name">{team.team?.name}</div>
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
              <div key={i} className="lineup-sub-row">
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

function MatchPreviewPanel({ fixtureId, homeName, awayName, t }) {
  const [pred, setPred]     = useState(null)
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
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">🔮</div>
      <h3>{t("match.noPrediction")}</h3>
    </div>
  )

  const { winner, percent, goals, advice, under_over, comparison } = pred
  const COMP_ROWS = [
    { key: "form",  label: t("match.predForm") },
    { key: "att",   label: t("match.predAttack") },
    { key: "def",   label: t("match.predDefense") },
    { key: "h2h",   label: "H2H" },
    { key: "goals", label: t("match.predGoals") },
    { key: "total", label: t("match.predTotal") },
  ]

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Winner chip */}
      {winner?.name && (
        <div style={{
          background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.2)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: "1.6rem" }}>🔮</span>
          <div>
            <div style={{ fontSize: "0.6rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>
              {t("match.matchPrediction")}
            </div>
            <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#fff" }}>{winner.name}</div>
            {advice && (
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", marginTop: 4 }}>{advice}</div>
            )}
          </div>
        </div>
      )}

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

      <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.2)", textAlign: "center", paddingTop: 4 }}>
        {t("match.predPoweredBy")}
      </div>
    </div>
  )
}

// ─── Live Odds Pulse ───────────────────────────────────────────────────────────

function LiveOddsPulse({ fixtureId, homeName, awayName, t }) {
  const [odds, setOdds] = useState(null)

  useEffect(() => {
    if (!fixtureId) return
    let mounted = true
    const poll = () =>
      fetch(`/api/v1/fixture_odds/${fixtureId}/live`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (mounted && d?.bets?.length) setOdds(d) })
        .catch(() => {})
    poll()
    const iv = setInterval(poll, 30000)
    return () => { mounted = false; clearInterval(iv) }
  }, [fixtureId])

  if (!odds?.bets?.length) return null

  // Prefer Asian Handicap for live in-play context; fall back to first available
  const handicap = odds.bets.find(b => b.name === "Asian Handicap")
  const overUnder = odds.bets.find(b => b.name === "Over/Under Line" || b.name.startsWith("Over/Under") && !b.name.includes("Half"))
  if (!handicap && !overUnder) return null

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 6, padding: "7px 16px", margin: "0 0 0",
      background: "rgba(16,185,129,.06)", borderTop: "1px solid rgba(16,185,129,.12)",
      borderBottom: "1px solid rgba(16,185,129,.12)",
      fontSize: "0.7rem", overflowX: "auto", WebkitOverflowScrolling: "touch",
      flexWrap: "wrap",
    }}>
      <span style={{ color: "#10b981", fontWeight: 700, letterSpacing: ".06em", fontSize: "0.62rem", flexShrink: 0 }}>
        ⚡ {t("match.liveOdds")}
      </span>
      {handicap && handicap.values.map(v => (
        <span key={v.value} style={{ background: "rgba(16,185,129,.1)", borderRadius: 6, padding: "3px 8px", color: "rgba(255,255,255,.75)", whiteSpace: "nowrap" }}>
          {v.value === "Home" ? homeName : v.value === "Away" ? awayName : v.value} {v.odd}
        </span>
      ))}
      {overUnder && overUnder.values.slice(0, 2).map(v => (
        <span key={v.value} style={{ background: "rgba(245,158,11,.08)", borderRadius: 6, padding: "3px 8px", color: "rgba(255,255,255,.6)", whiteSpace: "nowrap" }}>
          {v.value} {v.odd}
        </span>
      ))}
    </div>
  )
}

// ─── First Goal Scorer Odds ───────────────────────────────────────────────────

function FirstScorerOdds({ fixtureId, t }) {
  const [scorers, setScorers] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current || !fixtureId) return
    fetchedRef.current = true
    fetch(`/api/v1/fixture_odds/${fixtureId}`)
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
              <span style={{ fontWeight: i === 0 ? 700 : 500, fontSize: "0.85rem", color: "#fff" }}>{s.value}</span>
            </div>
            <span style={{
              background: i === 0 ? "rgba(238,30,70,.15)" : "rgba(255,255,255,.07)",
              color: i === 0 ? "#ee1e46" : "rgba(255,255,255,.6)",
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

  const [hw, d, aw] = h2h.summary || [0, 0, 0]
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
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "rgba(255,255,255,.5)" }}>{d}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{t("match.draw")}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#3b82f6" }}>{aw}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{awayTeamName}</div>
          </div>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
          <div style={{ width: `${(hw/total)*100}%`, background: "#ee1e46" }} />
          <div style={{ width: `${(d/total)*100}%`, background: "rgba(255,255,255,.2)" }} />
          <div style={{ flex: 1, background: "#3b82f6" }} />
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
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
                borderRadius: 6, fontSize: "0.8rem",
              }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: ".65rem", color: "var(--muted)" }}>{date}</div>
                  {m.competition?.name && <div style={{ fontSize: ".58rem", color: "#555", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{translateLeague(m.competition.name, lang)}</div>}
                </div>
                <span style={{ flex: 1, textAlign: "right", fontWeight: homeWon ? 800 : 500, color: homeWon ? "#fff" : "rgba(255,255,255,.5)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.home?.name}</span>
                <span style={{ fontWeight: 900, color: "#fff", padding: "3px 12px", background: "var(--surface2)", borderRadius: 4, fontSize: ".9rem", flexShrink: 0, minWidth: 64, textAlign: "center" }}>{hs} – {as}</span>
                <span style={{ flex: 1, fontWeight: awayWon ? 800 : 500, color: awayWon ? "#fff" : "rgba(255,255,255,.5)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.away?.name}</span>
              </div>
            )
          })}
        </div>
      </section>
    </>
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

// ─── Push notification banner for live matches ────────
function LivePushBanner({ homeName, awayName, onDismiss }) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, loading, subscribe, needsIosInstall } = usePushNotifications()
  const [done,   setDone]   = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  if ((!supported && !needsIosInstall) || permission === "denied" || subscribed || done) return null

  const enable = async () => {
    if (needsIosInstall) return
    setErrMsg(null)
    const res = await subscribe([homeName, awayName].filter(Boolean))
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
  const fetchedRef = useRef(false)   // only fetch once per mount — team names never change

  useEffect(() => {
    if (fetchedRef.current) return         // already fetched or in-flight; skip re-poll triggers
    if (!homeName && !awayName) return     // wait until names arrive from the first data load
    fetchedRef.current = true
    fetch(`/api/v1/news?lang=${lang}&limit=60`)
      .then(r => r.ok ? r.json() : [])
      .then(items => {
        if (!Array.isArray(items) || items.length === 0) return

        // Only include league as a keyword when it's a well-known named competition
        const leagueWords = leagueName &&
          NEWS_SEARCHABLE_LEAGUES.has(leagueName.toLowerCase().trim())
            ? leagueName.toLowerCase().split(/[\s\-\/]+/).filter(k => k.length > 3)
            : []

        // Build keyword set: all meaningful words from team names + (selective) league
        const words = [...[homeName, awayName]
          .filter(Boolean)
          .flatMap(n => n.toLowerCase().split(/[\s\-\/]+/))
          .filter(k => k.length > 3)
          // Remove generic words that appear in every football article
          .filter(k => !["real", "city", "club", "united", "atletico", "atleticó"].includes(k)),
          ...leagueWords,
        ]

        if (words.length === 0) return

        const filtered = items.filter(a => {
          const text = `${a.title} ${a.summary || ""}`.toLowerCase()
          return words.some(k => text.includes(k))
        })

        // Only show if we found genuinely relevant articles — never fall back to unrelated news
        if (filtered.length > 0) setArticles(filtered.slice(0, 4))
      })
      .catch(() => {})
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
  const [data, setData]         = useState(() => previewToFixture(preview))
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState("summary")
  const [toast, setToast]       = useState(null)
  const [showNotifBanner, setShowNotifBanner] = useState(false)
  const [aiSummary, setAiSummary]   = useState(null)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState(false)
  const toastQueue    = useRef([])   // queue so rapid goals don't cut each other short
  const toastTimer    = useRef(null)
  const swipeStartX   = useRef(null)
  const dataFetchedAt = useRef(0)    // timestamp of the most recent data update (poll or WS)

  // Detect if live
  const statusShort = data?.fixture?.fixture?.status?.short
  const isLive      = ["1H", "2H", "HT", "ET", "BT", "P", "INT"].includes(statusShort)
  const apiMinute   = data?.fixture?.fixture?.status?.elapsed
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

      if (Notification.permission === "granted") {
        new Notification(`⚽ Goal! ${homeName} ${h}–${a} ${awayName}`, {
          body: scorer?.player ? `${scorer.player} ${scorer.minute}'` : "",
          icon: "/images/apple-touch-icon.png?v=2",
        })
      }
    }
    prevGoalsRef.current = { h, a }
  }

  // Poll for data — guards against a stale response overwriting fresher WS data.
  // We capture fetchStarted *before* the network round-trip; if a WS message
  // arrived after this poll started (dataFetchedAt > fetchStarted), the poll
  // result is by definition staler and gets discarded.
  const load = useCallback(() => {
    const fetchStarted = Date.now()
    return fetch(`/api/v1/match_detail/${id}`)
      .then(r => r.json())
      .then(d => {
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
    setLoading(true)
    load().finally(() => setLoading(false))
    // Adaptive polling: 20s when live, 60s otherwise
    const interval = isLive ? 20000 : 60000
    const iv = setInterval(load, interval)
    return () => clearInterval(iv)
  }, [id, isLive])

  // ActionCable subscription — push updates when live.
  // Stamps dataFetchedAt so concurrent polls know this data is the freshest.
  const handleCableMessage = useCallback((msg) => {
    if (msg.type === "match_update") {
      dataFetchedAt.current = Date.now()
      setData(prev => {
        if (prev) checkGoals(msg.fixture?.goals, msg.events)
        return { fixture: msg.fixture, events: msg.events, stats: msg.stats, lineups: msg.lineups }
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

  // Fetch AI summary for finished matches (lazy — only when available)
  useEffect(() => {
    if (!data?.fixture) return
    const status = data?.fixture?.fixture?.status?.short
    const isFinished = ["FT", "AET", "PEN"].includes(status)
    if (!isFinished || aiSummary || aiLoading || aiError) return

    // Prefer DB-id endpoint (WC matches); fall back to external match-detail endpoint
    const lang        = i18n.language?.slice(0, 2) || "en"
    const matchDbId   = data?.fixture?.fixture?.localId || data?.fixture?.fixture?.db_id
    const summaryUrl  = matchDbId
      ? `/api/v1/matches/${matchDbId}/ai_summary?lang=${lang}`
      : `/api/v1/match_detail/${id}/ai_summary?lang=${lang}`

    setAiLoading(true)
    fetch(summaryUrl)
      .then(r => r.json())
      .then(d => {
        if (d.summary) setAiSummary(d)
        else setAiError(true)
      })
      .catch(() => setAiError(true))
      .finally(() => setAiLoading(false))
  }, [data?.fixture?.fixture?.status?.short, aiSummary, aiLoading, aiError]) // eslint-disable-line

  // Auto-select "preview" tab for pre-kickoff matches on first load
  useEffect(() => {
    if (!loading && statusShort && ["NS", "TBD"].includes(statusShort) && tab === "summary") {
      setTab("preview")
    }
  }, [loading, statusShort]) // eslint-disable-line

  // Back navigation
  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate("/scores/today")
  }

  if (loading) return <MatchSkeleton />

  const hasFixture  = !!data?.fixture
  const isApiError  = !hasFixture && data?.error === "api_error"

  const eventCount  = data?.events?.filter(e => ["Goal","Card","subst","Var","injury"].includes(e.type)).length ?? 0

  const notifSupported = typeof Notification !== "undefined"

  const hasStats    = data?.stats?.length > 0
  const hasLineups  = data?.lineups?.some(l => l?.start_xi?.length > 0)
  const hasH2H      = data?.h2h?.matches?.length > 0
  const hasEvents   = eventCount > 0
  const goalCount   = data?.events?.filter(e => e.type === "Goal").length ?? 0
  const isNS        = statusShort === "NS" || statusShort === "TBD"
  // Dynamic tab list — "preview" prepended for pre-kickoff matches
  const TAB_KEYS    = isNS ? ["preview", "summary", "lineups", "h2h"] : ["summary", "stats", "lineups", "h2h"]
  const TABS        = TAB_KEYS.map(k => ({ key: k, label: t(`match.${k}`) }))

  // Swipe between tabs
  function handleTabSwipeStart(e) { swipeStartX.current = e.touches[0].clientX }
  function handleTabSwipeEnd(e) {
    if (swipeStartX.current === null) return
    const dx = e.changedTouches[0].clientX - swipeStartX.current
    if (Math.abs(dx) < 60) { swipeStartX.current = null; return }
    const idx = TAB_KEYS.indexOf(tab)
    if (dx < 0 && idx < TAB_KEYS.length - 1) setTab(TAB_KEYS[idx + 1])
    else if (dx > 0 && idx > 0)              setTab(TAB_KEYS[idx - 1])
    swipeStartX.current = null
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
                    borderRadius: 6, padding: "4px 10px", fontSize: "0.68rem",
                    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                  title={`${prevMatchNav.home_team?.name} vs ${prevMatchNav.away_team?.name}`}
                >
                  ← {translateTeam(prevMatchNav.home_team?.name, i18n.language)?.split(" ")[0]}
                </button>
              )}
              {nextMatchNav && (
                <button
                  onClick={() => navigate(`/matches/${String(nextMatchNav.external_id)}`, { state: { matchList, matchIdx: matchIdx + 1 } })}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "4px 10px", fontSize: "0.68rem",
                    color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                  }}
                  title={`${nextMatchNav.home_team?.name} vs ${nextMatchNav.away_team?.name}`}
                >
                  {translateTeam(nextMatchNav.home_team?.name, i18n.language)?.split(" ")[0]} →
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
            matchId={id}
            notifEnabled={Notification?.permission === "granted"}
            notifSupported={notifSupported}
            onNotif={() => {}}
            events={data.events}
          />
        ) : (
          <div style={{ background: "var(--surface1,#0d1117)", padding: "48px 0 36px" }}>
            <div className="container" style={{ maxWidth: 700, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 12, opacity: .3 }}>⚽</div>
              <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem" }}>
                {isApiError ? t("error.dataUnavailable") : t("error.notFound")}
              </div>
            </div>
          </div>
        )
      }

      {/* Live Odds Pulse — compact strip shown during live matches */}
      {isLive && hasFixture && (
        <LiveOddsPulse fixtureId={id} homeName={homeName} awayName={awayName} t={t} />
      )}

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
            onDismiss={() => setShowNotifBanner(false)}
          />
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
          <MatchPreviewPanel
            fixtureId={id}
            homeName={homeName}
            awayName={awayName}
            t={t}
          />
        )}

        {tab === "summary" && (
          <>
            {/* Reactions — always shown; compact for live matches */}
            <div className="match-section" style={{ marginBottom: 12 }}>
              <MatchReactions matchId={id} compact={["1H","HT","2H","ET","BT","P"].includes(statusShort)} />
            </div>

            {hasFixture && <ScorePredictionPanel matchId={id} homeName={homeName} awayName={awayName} matchStatus={statusShort} kickoffAt={kickoffAt} t={t} />}
            {hasFixture && <PredictionPanel matchId={id} homeTeamName={homeName} awayTeamName={awayName} t={t} />}

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
                    <p style={{ lineHeight: 1.65, color: "rgba(255,255,255,.85)", fontSize: "0.88rem", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
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
              ? <EventsTimeline events={data.events} homeTeam={homeTeamRaw ?? homeName} awayTeam={awayTeamRaw ?? awayName} statusShort={statusShort} t={t} />
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
