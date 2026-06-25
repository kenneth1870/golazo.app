import { useMatches } from "../../hooks/useMatches"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../../i18n/teamNames"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useState, useEffect, useRef } from "react"

// WC 2026: R32 → R16 → QF → SF → Final (+ 3rd place)
const ROUNDS = [
  { key: "Round of 32",   labelKey: "bracket.r32",           count: 16 },
  { key: "Round of 16",   labelKey: "bracket.r16",           count: 8  },
  { key: "Quarter Final", labelKey: "bracket.quarterFinals", count: 4  },
  { key: "Semi Final",    labelKey: "bracket.semiFinals",    count: 2  },
  { key: "Final",         labelKey: "bracket.final",         count: 1  },
]
// Humanizes a knockout slot code into a short, localized label shown until a
// real team is resolved: "1A" → "Winner A"/"Ganador A", "2C" → "Runner-up C",
// "T3" → "3rd #3", "W29"/"L30" → "Winner"/"Loser". `t` is the i18n translator.
function slotLabel(slot, t) {
  if (!slot) return "TBD"
  const wr = slot.match(/^([12])([A-L])$/)
  if (wr) return `${wr[1] === "1" ? t("bracket.winner") : t("bracket.runnerUp")} ${wr[2]}`
  const th = slot.match(/^T(\d+)$/)
  if (th) return `${t("bracket.third")} #${th[1]}`
  if (/^W\d+$/.test(slot)) return t("bracket.winner")
  if (/^L\d+$/.test(slot)) return t("bracket.loser")
  return "TBD"
}

// Official WC 2026 R32 matchups (group winner vs runner-up)
const R32_SLOTS = [
  ["A1", "B2"], ["C1", "D2"], ["E1", "F2"], ["G1", "H2"],
  ["I1", "J2"], ["K1", "L2"], ["B1", "A2"], ["D1", "C2"],
  ["F1", "E2"], ["H1", "G2"], ["J1", "I2"], ["L1", "K2"],
  ["A1*","B2*"], ["C1*","D2*"], ["E1*","F2*"], ["G1*","H2*"],
]

function MatchSlot({ match, onClick }) {
  const { t, i18n } = useTranslation()
  const isLive      = match?.status === "live"
  const isFinished  = match?.status === "finished"
  const hasScore    = match?.home_score !== null && match?.away_score !== null
  const [flash, setFlash] = useState(false)
  const prevScore   = useRef({ h: match?.home_score, a: match?.away_score })

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

  return (
    <div
      className={`bracket-slot${isLive ? " bracket-slot--live" : ""}${isFinished ? " bracket-slot--finished" : ""}${flash ? " bracket-slot--score-updated" : ""}`}
      onClick={match.external_id ? onClick : undefined}
      style={{ cursor: match.external_id ? "pointer" : "default" }}
    >
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
          <span style={{ fontSize: "0.6rem" }}>{match.minute ? `${match.minute}'` : "LIVE"}</span>
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

function QualifierSlot({ label }) {
  const { t } = useTranslation()
  const isWinner = label.includes("1")
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "5px 8px",
      fontSize: "0.7rem", color: isWinner ? "var(--text)" : "var(--muted)",
      fontWeight: isWinner ? 700 : 400,
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        background: isWinner ? "rgba(238,30,70,.2)" : "var(--surface2)",
        border: `1px solid ${isWinner ? "rgba(238,30,70,.4)" : "var(--border)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.55rem", fontWeight: 800, color: isWinner ? "#ee1e46" : "#555",
      }}>
        {label.replace("*", "").slice(-1)}
      </span>
      <span>{t(isWinner ? "bracket.groupWinner" : "bracket.groupRunnerUp", { group: label.replace(/[12*]/g, "") })}</span>
    </div>
  )
}

function PlaceholderBracket() {
  const { t } = useTranslation()
  return (
    <div>
      <div style={{ textAlign: "center", padding: "24px 0 32px" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏆</div>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 6px" }}>{t("bracket.notYetDetermined")}</h3>
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", maxWidth: 340, margin: "0 auto" }}>
          {t("bracket.groupStageAdvance")}
        </p>
      </div>

      {/* Visual R32 bracket preview */}
      <div className="bracket-scroll-hint">{t("bracket.swipeHint")}</div>
      <div className="bracket-scroll-wrap">
        <div className="bracket">
          {/* R32 — show qualifier labels */}
          <div className="bracket-round" style={{ minWidth: 180 }}>
            <div className="bracket-round__label">{t("bracket.r32")}</div>
            <div className="bracket-round__slots">
              {R32_SLOTS.map(([home, away], i) => (
                <div key={i} className="bracket-round__slot-wrap">
                  <div className="bracket-slot bracket-slot--empty" style={{ minHeight: 60, flexDirection: "column", alignItems: "stretch", justifyContent: "center", padding: 0 }}>
                    <QualifierSlot label={home} />
                    <div className="bracket-slot__divider" />
                    <QualifierSlot label={away} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remaining rounds — empty slots */}
          {ROUNDS.slice(1).map(r => (
            <div key={r.key} className="bracket-round" style={{ minWidth: 160 }}>
              <div className="bracket-round__label">{t(r.labelKey)}</div>
              <div className="bracket-round__slots">
                {Array.from({ length: r.count }).map((_, i) => (
                  <div key={i} className="bracket-round__slot-wrap">
                    <div className="bracket-slot bracket-slot--empty">
                      <span className="bracket-slot__tbd">TBD</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function KnockoutPage() {
  const { t } = useTranslation()
  usePageMeta(t("bracket.knockoutStage"), "FIFA World Cup 2026 knockout bracket — Round of 32, Round of 16, Quarter Finals, Semi Finals and Final.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  const knockout   = matches.filter(m => !m.group_stage)
  const hasData    = knockout.length > 0

  const byPos = (a, b) => (a.bracket_pos ?? 0) - (b.bracket_pos ?? 0)
  // Exact round match — "Final" must not also capture "Quarter Final"/"Semi Final".
  const byRound = ROUNDS.reduce((acc, r) => {
    acc[r.key] = knockout
      .filter(m => m.round?.toLowerCase() === r.key.toLowerCase())
      .sort(byPos)
    return acc
  }, {})
  const thirdPlace = knockout
    .filter(m => m.round?.toLowerCase().includes("3rd") || m.round?.toLowerCase().includes("third"))
    .sort(byPos)

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
        <div className="bracket-scroll-wrap">
          <div className="bracket">
            {ROUNDS.map(r => (
              <RoundColumn
                key={r.key}
                label={t(r.labelKey)}
                matches={byRound[r.key]}
                count={r.count}
                onMatchClick={onMatchClick}
              />
            ))}
          </div>
        </div>

        {thirdPlace.length > 0 && (
          <div className="bracket-third-place">
            <div className="bracket-round__label" style={{ marginBottom: 8 }}>{t("bracket.thirdPlace")}</div>
            <div style={{ maxWidth: 260, margin: "0 auto" }}>
              <MatchSlot match={thirdPlace[0]} onClick={() => onMatchClick(thirdPlace[0].external_id)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
