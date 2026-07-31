import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react"
import { useParams, Link, useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../i18n/leagueNames"
import { translateTeam, resolveTeamLogo } from "../i18n/teamNames"
import SafeImg from "../components/SafeImg"
import { useExternalMatchChannel } from "../hooks/useExternalMatchChannel"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { useLiveMinute } from "./match/useMatchLive"
const ScorePredictionPanel = lazy(() => import("./match/ScorePredictionPanel"))
const MatchPreviewPanel = lazy(() => import("./match/MatchPreviewPanel"))
const PlayerRatingsPanel = lazy(() => import("./match/PlayerRatingsPanel"))
const MatchEventsPanel = lazy(() => import("./match/MatchEventsPanel"))
const MatchStatsPanel = lazy(() => import("./match/MatchStatsPanel"))
const MatchLineupsPanel = lazy(() => import("./match/MatchLineupsPanel"))
const MatchH2HPanel = lazy(() => import("./match/MatchH2HPanel"))
const MatchCommentaryPanel = lazy(() => import("./match/MatchCommentaryPanel"))
import { ScoreTimeline, MiniStatsBar } from "./match/MatchSummaryExtras"
import RelatedNewsStrip from "../components/RelatedNewsStrip"
const MatchReactions = lazy(() => import("../components/MatchReactions"))
import { buildMatchNewsQuery } from "../utils/newsQuery"
import { useReminders } from "../hooks/useReminders"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useVisiblePolling } from "../hooks/useVisiblePolling"
import { useAppFocus } from "../hooks/useAppFocus"
import { getCachedMatchDetail, setCachedMatchDetail, mergeCachedMatchDetail, fetchMatchDetailInclude, MATCH_DETAIL_INITIAL_INCLUDE, navIdFor } from "../utils/matchDetailCache"
import { getMatchColor } from "../utils/teamColors"
import { clubTeamPath } from "../utils/clubTeamPath"
import { leagueCodeFromApiId } from "../utils/leagueCodes"
import { sourceColor } from "../utils/sourceColors"
import { storageGet, storageSet } from "../utils/safeStorage"
import { buildMatchShareText, shareMatchText } from "../utils/matchShare"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"
import { formatKickoff } from "../hooks/useLocalTime"

// ─── Reminder button ──────────────────────────────────
function ReminderButton({ match }) {
  const { t, i18n } = useTranslation()
  const { isReminded, addReminder, removeReminder, enabled } = useReminders()
  const matchId = String(match?.external_id || match?.id || "")
  if (!enabled || !matchId || !match?.kickoff_at) return null
  const kickoff = new Date(match.kickoff_at).getTime()
  if (kickoff <= Date.now()) return null

  const reminded = isReminded(matchId)
  const toggle = async () => {
    if (reminded) removeReminder(matchId)
    else await addReminder(match)
  }
  const kickoffLabel = formatKickoff(match.kickoff_at, i18n.language)

  return (
    <button
      onClick={toggle}
      title={reminded ? t("match.reminderActive", { time: kickoffLabel }) : t("match.reminderSet", { time: kickoffLabel })}
      style={{
        background: reminded ? "rgba(16,185,129,.15)" : "none",
        border: reminded ? "1px solid rgba(16,185,129,.4)" : "1px solid var(--border)",
        borderRadius: 6, cursor: "pointer",
        color: reminded ? "var(--success)" : "var(--muted)",
        fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 4,
        padding: "5px 8px", transition: "all .2s",
      }}
    >
      {reminded ? `🔔 ${kickoffLabel}` : `🔕 ${t("match.remindMe")}`}
    </button>
  )
}

// ─── Share button ─────────────────────────────────────
function ShareButton({ homeName, awayName, homeScore, awayScore, statusShort, isLive, events, homeTeamRaw, round }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function share() {
    const text = buildMatchShareText({
      homeName,
      awayName,
      homeScore,
      awayScore,
      statusShort,
      isLive,
      events,
      homeTeamRaw,
      round,
      t,
    })
    const title = homeName && awayName ? `${homeName} vs ${awayName} — Golazo` : "Golazo"
    await shareMatchText({
      title,
      text,
      onCopied: () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
    })
  }

  return (
    <button
      type="button"
      onClick={share}
      className="match-share-btn focus-brand"
      aria-label={t("match.share")}
      style={{
        color: copied ? "var(--success)" : "var(--muted)",
        transition: "color .2s",
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



function FlagOrInitials({ name, src, size = 80 }) {
  const [err, setErr] = useState(false)
  const init = name?.slice(0, 3).toUpperCase() || "?"
  const logo = resolveTeamLogo(name, src)
  const badUrl = !logo || /teams\/0\.png/i.test(logo)
  if (logo && !badUrl && !err) {
    return (
      <img src={logo} alt={name}
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

function Scoreboard({ fixture, isLive, liveMinute, liveExtra, matchId, onShare, onNotif, notifEnabled, notifSupported, events, clubsPrimary = false }) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [venueImg, setVenueImg] = useState(null)
  const [venueCap, setVenueCap] = useState(null)

  const venueId = fixture?.fixture?.venue?.id
  useEffect(() => {
    if (!venueId) return
    fetchJson(`/api/v1/venue_detail/${venueId}`)
      .then(({ data: d, ok }) => {
        if (!ok || !d) return
        if (d.image) setVenueImg(d.image)
        if (d.capacity) setVenueCap(d.capacity)
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
      lines.push(`🔴 ${t("status.live")} · ${homeName} ${hs}–${as} ${awayName}`)
    } else if (isFT) {
      const winner = hs > as ? homeName : as > hs ? awayName : null
      lines.push(`⚽ ${t("status.ft")} · ${homeName} ${hs}–${as} ${awayName}${winner ? t("match.shareWin", { team: winner }) : ` · ${t("match.draw")}`}`)
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

  const leagueCode = leagueCodeFromApiId(fixture?.league?.id)

  function TeamNameLink({ team, name, isWinner }) {
    const cls = `scoreboard__team-name${isWinner ? " scoreboard__team-name--winner" : ""}`
    if (clubsPrimary && team?.name && leagueCode) {
      return (
        <Link to={clubTeamPath(leagueCode, team.name)} className={cls} style={{ textDecoration: "none", color: "inherit" }}>
          {name}
        </Link>
      )
    }
    if (team?.id) {
      return (
        <Link to={`/teams/${team.id}`} className={cls} style={{ textDecoration: "none", color: "inherit" }}>
          {name}
        </Link>
      )
    }
    return <div className={cls}>{name}</div>
  }

  const competitionRow = (
    <>
      <SafeImg src={fixture?.league?.logo} style={{ width: 18, height: 18, objectFit: "contain" }} />
      <span>{translateLeague(fixture?.league?.name, i18n.language)}</span>
      {fixture?.league?.round && (
        <span className="scoreboard__round">{translateRound(fixture.league.round, t)}</span>
      )}
    </>
  )

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
        {leagueCode ? (
          <Link to={`/leagues/${leagueCode}`} className="scoreboard__competition" style={{ textDecoration: "none", color: "inherit" }}>
            {competitionRow}
          </Link>
        ) : (
          <div className="scoreboard__competition">{competitionRow}</div>
        )}

        {/* Status pill */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          {isLive ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(238,30,70,.15)", border: "1px solid rgba(238,30,70,.4)",
              borderRadius: 20, padding: "5px 14px",
              fontSize: ".72rem", fontWeight: 800, color: "var(--accent)", letterSpacing: ".06em",
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
            <TeamNameLink team={home} name={homeName} isWinner={isFT && home?.winner} />
          </div>

          <div className="scoreboard__score-block">
            <div className="scoreboard__score" style={{ gap: 12 }}>
              <span style={{ color: isFT && home?.winner ? "var(--green)" : "#fff" }}>{goals?.home ?? (isNS ? "–" : "0")}</span>
              <span className="scoreboard__score-sep">:</span>
              <span style={{ color: isFT && away?.winner ? "var(--green)" : "#fff" }}>{goals?.away ?? (isNS ? "–" : "0")}</span>
            </div>
            {isFT && home?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "var(--green)" }}>
                {homeName} WIN
              </div>
            )}
            {isFT && away?.winner && (
              <div style={{ textAlign: "center", marginTop: 8, fontSize: ".6rem", fontWeight: 800, letterSpacing: ".1em", color: "var(--green)" }}>
                {awayName} WIN
              </div>
            )}
          </div>

          <div className="scoreboard__team scoreboard__team--away">
            <FlagOrInitials name={away?.name} src={away?.logo} size={76} />
            <TeamNameLink team={away} name={awayName} isWinner={isFT && away?.winner} />
          </div>
        </div>

        {/* Footer: venue + referee + share + notif */}
        <div className="scoreboard__footer">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {fixture?.fixture?.venue?.name && (
              clubsPrimary ? (
                <span className="scoreboard__venue">
                  📍 {fixture.fixture.venue.name}
                  {fixture.fixture.venue.city ? `, ${fixture.fixture.venue.city}` : ""}
                  {venueCap ? <span style={{ opacity: .5, marginLeft: 6 }}>· 🏟️ {venueCap.toLocaleString()}</span> : null}
                </span>
              ) : (
              <Link
                to={`/mundial/venues/${fixture.fixture.venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
                className="scoreboard__venue"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                📍 {fixture.fixture.venue.name}
                {fixture.fixture.venue.city ? `, ${fixture.fixture.venue.city}` : ""}
                {venueCap ? <span style={{ opacity: .5, marginLeft: 6 }}>· 🏟️ {venueCap.toLocaleString()}</span> : null}
              </Link>
              )
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
                  color: notifEnabled ? "var(--success)" : "rgba(255,255,255,.5)",
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


// ─── Goal flash toast ──────────────────────────────────
function GoalToast({ text, visible, onDismiss }) {
  if (!visible) return null
  return (
    <div className="goal-toast" onClick={onDismiss} role="status">
      <span className="goal-toast__icon">⚽</span>
      <span className="goal-toast__text">{text}</span>
      <span className="goal-toast__close">✕</span>
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
              color: prefs[key] ? "var(--success)" : "var(--muted)",
            }}
          >{label}</button>
        ))}
      </div>
    </div>
  )
}

// ─── Push notification banner for live matches ────────
function LivePushBanner({ homeName, awayName, teamNamesRaw, leagueCode, onDismiss }) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, loading, subscribe, needsIosInstall } = usePushNotifications()
  const [done,   setDone]   = useState(false)
  const [errMsg, setErrMsg] = useState(null)

  if ((!supported && !needsIosInstall) || permission === "denied" || subscribed || done) return null

  const enable = async () => {
    if (needsIosInstall) return
    setErrMsg(null)
    const teamNames = (teamNamesRaw || [homeName, awayName]).filter(Boolean)
    const competitionCodes = leagueCode ? [leagueCode] : []
    const res = await subscribe(teamNames, competitionCodes)
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
          background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6,
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

// ─── Tab section error ─────────────────────────────────
function TabSectionError({ onRetry, t }) {
  return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">⚠️</div>
      <h3>{t("error.dataUnavailable", "Data unavailable")}</h3>
      <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>{t("error.retry")}</button>
    </div>
  )
}

// ─── Skeleton loader ───────────────────────────────────
function MatchSkeleton() {
  return (
    <div>
      {/* Scoreboard skeleton */}
      <div style={{ background: "var(--bg)", padding: "48px 0 36px" }}>
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
    // Omit events/stats/lineups/h2h — empty arrays block lazy tab fetches (=== undefined check).
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
  const [stale, setStale]       = useState(false)
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
  const sectionsFetchedRef = useRef(new Set())
  const [sectionErrors, setSectionErrors] = useState({})
  const [sectionLoading, setSectionLoading] = useState({})

  // Detect if live
  const statusShort = data?.fixture?.fixture?.status?.short
  const isLive      = ["1H", "2H", "HT", "ET", "BT", "P", "INT"].includes(statusShort)
  const homeScore   = data?.fixture?.goals?.home
  const awayScore   = data?.fixture?.goals?.away
  const apiMinute   = data?.fixture?.fixture?.status?.elapsed
  const apiExtra    = data?.fixture?.fixture?.status?.extra
  const liveMinute  = useLiveMinute(apiMinute, isLive)

  const homeTeamRaw = data?.fixture?.teams?.home?.name  // raw API name for event comparisons
  const awayTeamRaw = data?.fixture?.teams?.away?.name
  const homeName    = translateTeam(homeTeamRaw, i18n.language)
  const awayName    = translateTeam(awayTeamRaw, i18n.language)
  const leagueCode  = leagueCodeFromApiId(data?.fixture?.league?.id)
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
    fetchJson(`/api/v1/today?date=${date}`, { soft: true })
      .then(({ data, ok, offline }) => {
        const items = ok && !offline && Array.isArray(data) ? data : []
        if (items.length === 0) return
        const idx = items.findIndex(m => String(m.external_id) === String(id))
        if (idx === -1) return
        setFallbackList(items)
        setFallbackIdx(idx)
      })
      .catch(() => {})
  }, [kickoffAt, stateList.length, id])

  const prevMatchNav = matchIdx > 0                    ? matchList[matchIdx - 1] : null
  const nextMatchNav = matchIdx < matchList.length - 1 ? matchList[matchIdx + 1] : null
  const { clubs_primary: clubsPrimary, push_enabled: pushEnabled } = useAppFocus()
  const leagueLabel = translateLeague(data?.fixture?.league?.name, i18n.language) ?? data?.fixture?.league?.name ?? t("nav.leagues")
  const metaDesc = homeName && awayName
    ? (homeScore != null && awayScore != null && (isLive || ["FT", "AET", "PEN"].includes(statusShort))
        ? `${homeName} ${homeScore}–${awayScore} ${awayName} — ${leagueLabel}`
        : clubsPrimary
          ? t("meta.matchDescClubs", { home: homeName, away: awayName, competition: leagueLabel })
          : t("meta.matchDescWC", { home: homeName, away: awayName }))
    : undefined
  usePageMeta(
    homeName && awayName ? `${homeName} vs ${awayName}` : t("match.summary"),
    metaDesc,
    { type: "article", image: homeLogo || undefined }
  )
  useStructuredData(homeName && awayName ? {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${homeName} vs ${awayName}`,
    "description": metaDesc,
    "startDate": kickoffAt,
    "sport": "Soccer",
    "homeTeam": { "@type": "SportsTeam", "name": homeName },
    "awayTeam": { "@type": "SportsTeam", "name": awayName },
    ...(data?.fixture?.league?.id === 1 ? {
      "organizer": { "@type": "Organization", "name": "FIFA", "url": "https://www.fifa.com" },
    } : {}),
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
  const checkGoals = useCallback((goals, events) => {
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
  }, [])

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
    setStale(false)
    return fetchJson(fetchMatchDetailInclude(id, MATCH_DETAIL_INITIAL_INCLUDE), 10000)
      .then(({ data: d, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) {
          setData(prev => (prev?.fixture ? prev : { error: "api_error" }))
          return
        }
        if (d?.fixture) mergeCachedMatchDetail(id, d)
        setData(prev => {
          if (fetchStarted < dataFetchedAt.current) return prev  // WS beat us — keep fresher data
          dataFetchedAt.current = fetchStarted
          const merged = { ...prev, ...d }
          if (prev && isLive) checkGoals(merged.fixture?.goals, merged.events)
          return merged
        })
      })
      .catch(() => {
        setData(prev => (prev?.fixture ? prev : { error: "api_error" }))
      })
  }, [id, isLive, checkGoals])

  useEffect(() => {
    sectionsFetchedRef.current = new Set()
    setSectionErrors({})
    setSectionLoading({})
    const cached = getCachedMatchDetail(id)
    if (cached) { setData(cached); setLoading(false) } else { setLoading(true) }
    load().finally(() => setLoading(false))
  }, [id, load])

  const loadSections = useCallback((sections) => {
    if (!id || sections.length === 0) return Promise.resolve()
    sections.forEach(s => {
      sectionsFetchedRef.current.add(s)
      setSectionErrors(prev => ({ ...prev, [s]: false }))
      setSectionLoading(prev => ({ ...prev, [s]: true }))
    })
    return fetchJson(fetchMatchDetailInclude(id, sections.join(",")), 10000)
      .then(({ data: d, ok, offline }) => {
        if (!ok || offline || !d) {
          sections.forEach(s => {
            sectionsFetchedRef.current.delete(s)
            setSectionErrors(prev => ({ ...prev, [s]: true }))
          })
          return
        }
        setData(prev => {
          const merged = mergeCachedMatchDetail(id, { ...prev, ...d })
          return merged || { ...prev, ...d }
        })
      })
      .catch(() => {
        sections.forEach(s => {
          sectionsFetchedRef.current.delete(s)
          setSectionErrors(prev => ({ ...prev, [s]: true }))
        })
      })
      .finally(() => {
        sections.forEach(s => setSectionLoading(prev => ({ ...prev, [s]: false })))
      })
  }, [id])

  // Adaptive polling: 20s when live, 60s otherwise. Paused while the tab is
  // hidden — match_detail is the heaviest endpoint (external API call + DB
  // writes + ActionCable broadcasts on every hit), so a backgrounded tab must
  // not keep hammering it.
  useVisiblePolling(load, isLive ? 30000 : 60000, [id, load, isLive])

  // Lazy-load heavy sections when their tab is opened.
  useEffect(() => {
    if (!id || loading || !data?.fixture) return
    const sections = []
    const needs = (key) => data[key] === undefined && !sectionsFetchedRef.current.has(key)
    if (tab === "stats" && needs("stats")) sections.push("stats")
    if (tab === "lineups" && needs("lineups")) sections.push("lineups")
    if (tab === "h2h" && needs("h2h")) sections.push("h2h")
    if (sections.length === 0) return
    loadSections(sections)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to section keys only, not whole data object
  }, [tab, id, loading, data?.fixture, data?.stats, data?.lineups, data?.h2h, loadSections])

  // ActionCable subscription — push updates when live.
  // Stamps dataFetchedAt so concurrent polls know this data is the freshest.
  const handleCableMessage = useCallback((msg) => {
    if (msg.type === "match_update" && msg.fixture) {
      dataFetchedAt.current = Date.now()
      setData(prev => {
        if (prev) checkGoals(msg.fixture?.goals, msg.events)
        return {
          fixture: msg.fixture,
          events: msg.events ?? prev?.events,
          stats: msg.stats ?? prev?.stats,
          lineups: msg.lineups ?? prev?.lineups,
          h2h: prev?.h2h,
        }
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
  }, [checkGoals])

  useExternalMatchChannel(isLive ? id : null, handleCableMessage)

  // Show push banner on live matches when not yet granted
  useEffect(() => {
    if (!pushEnabled) return
    if (!isLive) return
    if (typeof Notification === "undefined") return
    if (Notification.permission === "default") setShowNotifBanner(true)
  }, [isLive, pushEnabled])

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

    let cancelled = false
    setAiLoading(true)
    fetchJson(summaryUrl, { timeoutMs: 30_000, soft: true })
      .then(({ data: d, ok, offline }) => {
        if (cancelled) return
        if (ok && !offline && d?.summary) setAiSummary(d)
        else setAiError(true)
      })
      .catch(err => { if (!cancelled && err.name !== "AbortError") setAiError(true) })
      .finally(() => { if (!cancelled) setAiLoading(false) })
    return () => { cancelled = true }
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

      <div className="container">
        <OfflineBanner stale={stale} onRetry={() => { setLoading(true); load().finally(() => setLoading(false)) }} />
      </div>

      {/* Back bar — visible on mobile above scoreboard */}
      <div className="match-back-bar">
        <div className="container match-back-bar__inner">
          <button onClick={goBack} className="btn-back match-back-bar__back">← {t("nav.back")}</button>

          {/* Prev / next match navigation */}
          {(prevMatchNav || nextMatchNav) && (
            <div className="match-back-bar__nav">
              {prevMatchNav && (
                <button
                  type="button"
                  className="match-back-bar__nav-btn match-back-bar__nav-btn--compact"
                  onClick={() => {
                    const navId = navIdFor(prevMatchNav)
                    if (navId) navigate(`/matches/${navId}`, { state: { matchList, matchIdx: matchIdx - 1 } })
                  }}
                  title={`${prevMatchNav.home_team?.name} vs ${prevMatchNav.away_team?.name}`}
                  aria-label={t("a11y.prevMatch", { defaultValue: "Previous match" })}
                >
                  <span className="match-back-bar__nav-short">←</span>
                  <span className="match-back-bar__nav-label">
                    {translateTeam(prevMatchNav.home_team?.name, i18n.language)?.split(" ")?.[0]}
                  </span>
                </button>
              )}
              {nextMatchNav && (
                <button
                  type="button"
                  className="match-back-bar__nav-btn match-back-bar__nav-btn--compact"
                  onClick={() => {
                    const navId = navIdFor(nextMatchNav)
                    if (navId) navigate(`/matches/${navId}`, { state: { matchList, matchIdx: matchIdx + 1 } })
                  }}
                  title={`${nextMatchNav.home_team?.name} vs ${nextMatchNav.away_team?.name}`}
                  aria-label={t("a11y.nextMatch", { defaultValue: "Next match" })}
                >
                  <span className="match-back-bar__nav-label">
                    {translateTeam(nextMatchNav.home_team?.name, i18n.language)?.split(" ")?.[0]}
                  </span>
                  <span className="match-back-bar__nav-short">→</span>
                </button>
              )}
            </div>
          )}

          <div className="match-back-bar__actions">
            {isLive && (
              <span className="match-back-bar__live-hint">
                <span className="live-dot" /> {t("match.updatingEvery")}
              </span>
            )}
            {!isLive && <ReminderButton match={data?.fixture ? { ...data.fixture.fixture, home_team: data.fixture.teams?.home, away_team: data.fixture.teams?.away, kickoff_at: data.fixture.fixture?.date, external_id: id } : null} />}
            <ShareButton
              homeName={homeName}
              awayName={awayName}
              homeScore={homeScore}
              awayScore={awayScore}
              statusShort={statusShort}
              isLive={isLive}
              events={data?.events}
              homeTeamRaw={homeTeamRaw}
              round={data?.fixture?.league?.round}
            />
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
            clubsPrimary={clubsPrimary}
            notifEnabled={notifSupported && pushSubscribed && matchTeamsNotified}
            notifSupported={notifSupported}
            onNotif={() => pushSubscribed && addTeams([homeTeamRaw, awayTeamRaw].filter(Boolean))}
            events={data.events}
          />
        ) : (
          <div style={{ background: "var(--bg)", padding: "48px 0 36px" }}>
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
          <div className="tab-bar__inner tab-bar__inner--scroll">
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
            leagueCode={leagueCode}
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
            {hasFixture && isNS && !clubsPrimary && (
              <Suspense fallback={null}>
                <ScorePredictionPanel matchId={id} homeName={homeName} awayName={awayName} matchStatus={statusShort} kickoffAt={kickoffAt} t={t} />
              </Suspense>
            )}
            <Suspense fallback={<div className="loading-shimmer" style={{ height: 120, borderRadius: 12 }} />}>
              <MatchPreviewPanel
                fixtureId={id}
                homeName={homeName}
                awayName={awayName}
                h2h={data?.h2h}
                t={t}
              />
            </Suspense>
          </>
        )}

        {tab === "summary" && (
          <>
            {/* Reactions — always shown; compact for live matches */}
            <div className="match-section" style={{ marginBottom: 12 }}>
              <Suspense fallback={null}>
                <MatchReactions matchId={id} compact={["1H","HT","2H","ET","BT","P"].includes(statusShort)} />
              </Suspense>
            </div>

            {hasFixture && !clubsPrimary && (
              <Suspense fallback={null}>
                <ScorePredictionPanel matchId={id} homeName={homeName} awayName={awayName} matchStatus={statusShort} kickoffAt={kickoffAt} t={t} />
              </Suspense>
            )}

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
              ? (
                <Suspense fallback={<div className="loading-shimmer" style={{ height: 120, borderRadius: 12 }} />}>
                  <MatchEventsPanel events={data.events} homeTeam={homeTeamRaw ?? homeName} awayTeam={awayTeamRaw ?? awayName} t={t} i18n={i18n} />
                </Suspense>
              )
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
          sectionErrors.stats ? (
            <TabSectionError onRetry={() => loadSections(["stats"])} t={t} />
          ) : (sectionLoading.stats || data?.stats === undefined) ? (
            <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />
          ) : (
            <Suspense fallback={<div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />}>
              <MatchStatsPanel stats={data?.stats} home={data?.fixture?.teams?.home} away={data?.fixture?.teams?.away} t={t} statusShort={statusShort} />
            </Suspense>
          )
        )}

        {tab === "lineups" && (
          sectionErrors.lineups ? (
            <TabSectionError onRetry={() => loadSections(["lineups"])} t={t} />
          ) : (sectionLoading.lineups || data?.lineups === undefined) ? (
            <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />
          ) : (
            <Suspense fallback={<div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />}>
              <MatchLineupsPanel lineups={data?.lineups} fixtureId={id} t={t} statusShort={statusShort} />
            </Suspense>
          )
        )}

        {tab === "h2h" && (
          sectionErrors.h2h ? (
            <TabSectionError onRetry={() => loadSections(["h2h"])} t={t} />
          ) : (sectionLoading.h2h || data?.h2h === undefined) ? (
            <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />
          ) : (
            <Suspense fallback={<div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />}>
              <MatchH2HPanel h2h={data?.h2h} homeTeamName={homeName} awayTeamName={awayName} t={t} lang={i18n.language} />
            </Suspense>
          )
        )}

        {tab === "ratings" && (
          <Suspense fallback={<div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />}>
            <PlayerRatingsPanel fixtureId={id} />
          </Suspense>
        )}

        {tab === "feed" && (
          <Suspense fallback={<div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />}>
            <MatchCommentaryPanel events={data?.events} homeTeamRaw={homeTeamRaw} homeName={homeName} awayName={awayName} />
          </Suspense>
        )}

        {/* Related News — shown on every tab when fixture is loaded */}
        {hasFixture && (
          <RelatedNewsStrip
            title={t("match.relatedNews")}
            lang={i18n.language?.slice(0, 2) || "en"}
            query={buildMatchNewsQuery(homeName, awayName, data?.fixture?.league?.name)}
            limit={4}
          />
        )}
        </div>
      </div>
    </div>
  )
}
