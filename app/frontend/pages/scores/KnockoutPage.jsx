import { useMatches } from "../../hooks/useMatches"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../../i18n/teamNames"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useState, useEffect, useRef } from "react"

// Humanizes a knockout slot code: "1A" → "Winner A", "T3" → "3rd #3", etc.
function slotLabel(slot, t) {
  if (!slot) return "TBD"
  const wr = slot.match(/^([12])([A-L])$/)
  if (wr) return `${wr[1] === "1" ? t("bracket.winner") : t("bracket.runnerUp")} ${wr[2]}`
  const th = slot.match(/^T(\d+)$/)
  if (th) return `${t("bracket.third")} #${th[1]}`
  const wm = slot.match(/^W(\d+)$/)
  if (wm) return `${t("bracket.winner")} M${wm[1]}`
  const lm = slot.match(/^L(\d+)$/)
  if (lm) return `${t("bracket.loser")} M${lm[1]}`
  return "TBD"
}

function matchDateLabel(kickoff, status, t, locale) {
  if (!kickoff) return null
  const d   = new Date(kickoff)
  const now = new Date()
  const diffDays = Math.round((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  const time = new Date(kickoff).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })

  let dayLabel
  if (diffDays === 0)       dayLabel = t("time.today")
  else if (diffDays === -1) dayLabel = t("time.yesterday")
  else if (diffDays === 1)  dayLabel = t("time.tomorrow")
  else {
    const weekday = new Date(kickoff).toLocaleDateString(locale, { weekday: "short" })
    const mday    = new Date(kickoff).toLocaleDateString(locale, { day: "numeric", month: "numeric" })
    dayLabel = `${weekday}, ${mday}`
  }

  if (status === "finished") {
    return dayLabel
  }
  return `${dayLabel}, ${time}`
}

function MatchSlot({ match, onClick }) {
  const { t, i18n } = useTranslation()
  const isLive     = match?.status === "live"
  const isFinished = match?.status === "finished"
  const hasScore   = match?.home_score !== null && match?.away_score !== null
  const [flash, setFlash] = useState(false)
  const prevScore  = useRef({ h: match?.home_score, a: match?.away_score })

  useEffect(() => {
    if (!match) return
    const { h, a } = prevScore.current
    if ((h !== null && match.home_score !== h) || (a !== null && match.away_score !== a)) {
      setFlash(true)
      setTimeout(() => setFlash(false), 900)
    }
    prevScore.current = { h: match.home_score, a: match.away_score }
  }, [match?.home_score, match?.away_score]) // eslint-disable-line

  if (!match) {
    return (
      <div className="bracket-slot bracket-slot--empty">
        <span className="bracket-slot__tbd">TBD</span>
      </div>
    )
  }

  const dateLabel = matchDateLabel(match?.kickoff_at, match?.status, t, i18n.language)

  return (
    <div
      className={`bracket-slot${isLive ? " bracket-slot--live" : ""}${isFinished ? " bracket-slot--finished" : ""}${flash ? " bracket-slot--score-updated" : ""}`}
      onClick={match.external_id ? onClick : undefined}
      style={{ cursor: match.external_id ? "pointer" : "default" }}
    >
      {dateLabel && (
        <div className="bracket-slot__header">
          <span className="bracket-slot__date">{dateLabel}</span>
          {isFinished && (
            <span className="bracket-slot__badge">{t("status.ft")}</span>
          )}
          {isLive && (
            <span className="bracket-slot__badge bracket-slot__badge--live">
              {match.minute ? `${match.minute}'` : t("status.live")}
            </span>
          )}
        </div>
      )}
      <div className="bracket-slot__team">
        {match.home_team?.flag_url && (
          <img src={match.home_team.flag_url} alt="" className="flag-xs"
            onError={e => (e.target.style.display = "none")} />
        )}
        <span className={`bracket-slot__name${isFinished && match.home_score > match.away_score ? " bracket-slot__name--winner" : ""}${match.home_team?.name ? "" : " bracket-slot__name--tbd"}`}>
          {match.home_team?.name ? translateTeam(match.home_team.name, i18n.language) : slotLabel(match.home_slot, t)}
        </span>
        {hasScore && (
          <span className={`bracket-slot__score${isLive ? " bracket-slot__score--live" : ""}`}>
            {match.home_score}
          </span>
        )}
      </div>
      <div className="bracket-slot__divider" />
      <div className="bracket-slot__team">
        {match.away_team?.flag_url && (
          <img src={match.away_team.flag_url} alt="" className="flag-xs"
            onError={e => (e.target.style.display = "none")} />
        )}
        <span className={`bracket-slot__name${isFinished && match.away_score > match.home_score ? " bracket-slot__name--winner" : ""}${match.away_team?.name ? "" : " bracket-slot__name--tbd"}`}>
          {match.away_team?.name ? translateTeam(match.away_team.name, i18n.language) : slotLabel(match.away_slot, t)}
        </span>
        {hasScore && (
          <span className={`bracket-slot__score${isLive ? " bracket-slot__score--live" : ""}`}>
            {match.away_score}
          </span>
        )}
      </div>
      {isLive && (
        <div className="bracket-slot__live-bar">
          <span className="live-dot" />
          <span style={{ fontSize: "0.6rem" }}>{match.minute ? `${match.minute}'` : t("status.live")}</span>
        </div>
      )}
    </div>
  )
}

function RoundColumn({ label, matches, count, onMatchClick }) {
  const slots = Array.from({ length: count }, (_, i) => matches[i] ?? null)
  return (
    <div className="bracket-round">
      <div className="bracket-round__label">{label}</div>
      <div className="bracket-round__slots">
        {slots.map((m, i) => (
          <div key={m?.id ?? `empty-${i}`} className="bracket-round__slot-wrap">
            <MatchSlot
              match={m}
              onClick={() => m?.external_id && onMatchClick(m.external_id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaceholderBracket() {
  const { t } = useTranslation()
  return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🏆</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 8px" }}>
        {t("bracket.notYetDetermined")}
      </h3>
      <p style={{ color: "var(--muted)", fontSize: "0.82rem", maxWidth: 340, margin: "0 auto" }}>
        {t("bracket.groupStageAdvance")}
      </p>
    </div>
  )
}

export default function KnockoutPage() {
  const { t } = useTranslation()
  usePageMeta(t("bracket.knockoutStage"), "FIFA World Cup 2026 knockout bracket — Round of 32, Round of 16, Quarter Finals, Semi Finals and Final.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  const knockout = matches.filter(m => !m.group_stage)
  const hasData  = knockout.length > 0

  const byPos = (a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)

  function getRound(key) {
    return knockout.filter(m => m.round?.toLowerCase() === key.toLowerCase()).sort(byPos)
  }

  // Split sorted round matches into left half (first n) and right half (remaining)
  function halfSplit(arr, half) {
    return [arr.slice(0, half), arr.slice(half)]
  }

  const [r32L, r32R] = halfSplit(getRound("Round of 32"),   8)
  const [r16L, r16R] = halfSplit(getRound("Round of 16"),   4)
  const [qfL,  qfR]  = halfSplit(getRound("Quarter Final"), 2)
  const [sfL,  sfR]  = halfSplit(getRound("Semi Final"),    1)
  const finalMatch   = getRound("Final")[0] ?? null
  const thirdMatch   = knockout
    .filter(m => m.round?.toLowerCase().includes("3rd") || m.round?.toLowerCase().includes("third"))
    .sort(byPos)[0] ?? null

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (!hasData) return (
    <div className="site-section">
      <div className="container">
        <PlaceholderBracket />
      </div>
    </div>
  )

  return (
    <div className="site-section">
      <div className="container">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <Link to="/predictor" style={{
            background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.3)",
            borderRadius: 8, color: "#ee1e46", padding: "7px 14px",
            fontSize: "0.78rem", fontWeight: 700, textDecoration: "none",
          }}>🏆 {t("bracket.predictorLink")}</Link>
        </div>
        <div className="bracket-scroll-hint">{t("bracket.swipeHint")}</div>
        <div className="bracket-mirrored-wrap">
          <div className="bracket-mirrored">

            {/* Left half: R32 → R16 → QF → SF (converging right toward center) */}
            <div className="bracket-half bracket-half--left">
              <RoundColumn label={t("bracket.r32")}           matches={r32L} count={8} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.r16")}           matches={r16L} count={4} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.quarterFinals")} matches={qfL}  count={2} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.semiFinals")}    matches={sfL}  count={1} onMatchClick={onMatchClick} />
            </div>

            {/* Center: trophy + World Champion title + Final match */}
            <div className="bracket-center">
              <div className="bracket-center__trophy">🏆</div>
              <div className="bracket-center__title">{t("bracket.worldChampion")}</div>
              <div className="bracket-center__match">
                <MatchSlot
                  match={finalMatch}
                  onClick={() => finalMatch?.external_id && onMatchClick(finalMatch.external_id)}
                />
              </div>
              <div className="bracket-center__round-label">{t("bracket.final")}</div>
            </div>

            {/* Right half: SF → QF → R16 → R32 (diverging right from center) */}
            <div className="bracket-half bracket-half--right">
              <RoundColumn label={t("bracket.semiFinals")}    matches={sfR}  count={1} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.quarterFinals")} matches={qfR}  count={2} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.r16")}           matches={r16R} count={4} onMatchClick={onMatchClick} />
              <RoundColumn label={t("bracket.r32")}           matches={r32R} count={8} onMatchClick={onMatchClick} />
            </div>

          </div>

          {/* Third place / Bronze medal match */}
          {thirdMatch && (
            <div className="bracket-bronze">
              <div className="bracket-round__label">{t("bracket.thirdPlace")}</div>
              <div className="bracket-bronze__match">
                <MatchSlot
                  match={thirdMatch}
                  onClick={() => thirdMatch.external_id && onMatchClick(thirdMatch.external_id)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
