import { useMatches } from "../../hooks/useMatches"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useState, useEffect, useRef } from "react"

// Layout constants — kept compact so the full bracket fits on most desktops
const SLOT_H     = 90     // px — height of one R32 slot (×8 = TOTAL_H)
const CARD_W     = 140    // px — match card width
const CONN_W     = 32     // px — SVG connector width between columns
const CTR_W      = 168    // px — center Final column
const TOTAL_H    = SLOT_H * 8                          // 720px
const BRACKET_W  = CARD_W * 8 + CONN_W * 8 + CTR_W   // 1448px total
const MOBILE_BP  = 640    // px — below this use scroll, above use auto-scale

// FIFA match number: bracket_pos 1 → P73, 2 → P74 … 32 → P104
const pNum = (pos) => pos ? `P${pos + 72}` : null

// Display code for a team (3-letter) or a slot label.
// Converts internal W{bracket_pos} refs → W{P_number} (W11 → W83, W17 → W89…)
// so unresolved slots match the official FIFA P-number format.
function teamCode(team, slot) {
  if (team?.code) return team.code.toUpperCase()
  if (!slot) return "?"
  const m = slot.match(/^([WL])(\d+)$/)
  if (m) return `${m[1]}${parseInt(m[2]) + 72}`
  return slot
}

// ── Team row inside a card ──────────────────────────────────────────────────
function TeamRow({ team, slot, score, penScore, isWinner, isLive, dim }) {
  const code = teamCode(team, slot)
  const hasTeam = !!(team?.name || team?.code)
  return (
    <div className={`bk2-row${isWinner ? " bk2-row--win" : ""}${dim ? " bk2-row--dim" : ""}`}>
      {team?.flag_url
        ? <img src={team.flag_url} alt="" className="bk2-flag"
            onError={e => (e.target.style.display = "none")} />
        : <span className="bk2-flag-ph" />
      }
      <span className={`bk2-code${!hasTeam ? " bk2-code--tbd" : ""}`}>{code}</span>
      <span className="bk2-score-area">
        {penScore != null && <span className="bk2-pen">({penScore})</span>}
        {score != null && (
          <span className={`bk2-score${isWinner ? " bk2-score--win" : ""}${isLive ? " bk2-score--live" : ""}`}>
            {score}
          </span>
        )}
      </span>
    </div>
  )
}

// ── Match card ──────────────────────────────────────────────────────────────
function MatchCard({ match, onClick, pLabel }) {
  const { t, i18n } = useTranslation()
  const [flash, setFlash] = useState(false)
  const prev = useRef({ h: match?.home_score, a: match?.away_score })

  useEffect(() => {
    if (!match) return
    const { h, a } = prev.current
    if (match.home_score !== h || match.away_score !== a) {
      setFlash(true)
      setTimeout(() => setFlash(false), 900)
    }
    prev.current = { h: match.home_score, a: match.away_score }
  }, [match?.home_score, match?.away_score]) // eslint-disable-line

  if (!match) {
    return (
      <div className="bk2-card bk2-card--empty">
        <TeamRow />
        <div className="bk2-div" />
        <TeamRow />
      </div>
    )
  }

  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasPen     = match.home_pen_score != null && match.away_pen_score != null
  const homeWon    = isFinished && (hasPen
    ? match.home_pen_score > match.away_pen_score
    : (match.home_score ?? -1) > (match.away_score ?? -1))
  const awayWon    = isFinished && (hasPen
    ? match.away_pen_score > match.home_pen_score
    : (match.away_score ?? -1) > (match.home_score ?? -1))

  // Header text
  let header = null
  if (isLive) {
    header = { text: match.minute ? `${match.minute}'` : t("status.live"), live: true }
  } else if (isFinished) {
    header = { text: t("status.ft") || "FT", done: true }
  } else if (match.kickoff_at) {
    const d    = new Date(match.kickoff_at)
    const date = d.toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "numeric" })
    const time = d.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit", hour12: false })
    header = { text: `${date}  ${time}` }
  }

  return (
    <div
      className={`bk2-card${isLive ? " bk2-card--live" : ""}${isFinished ? " bk2-card--done" : ""}${flash ? " bk2-card--flash" : ""}${match.external_id ? " bk2-card--click" : ""}`}
      onClick={match.external_id ? onClick : undefined}
    >
      {(header || pLabel) && (
        <div className={`bk2-hdr${header?.live ? " bk2-hdr--live" : ""}${header?.done ? " bk2-hdr--done" : ""}`}>
          {header?.live && <span className="live-dot" />}
          {header?.text}
          {hasPen && isFinished && !header?.live && (
            <span className="bk2-hdr-pen">· Pens</span>
          )}
          {pLabel && <span className="bk2-hdr-pnum">{pLabel}</span>}
        </div>
      )}
      <TeamRow
        team={match.home_team} slot={match.home_slot}
        score={match.home_score} penScore={match.home_pen_score}
        isWinner={homeWon} isLive={isLive}
        dim={isFinished && !homeWon && awayWon}
      />
      <div className="bk2-div" />
      <TeamRow
        team={match.away_team} slot={match.away_slot}
        score={match.away_score} penScore={match.away_pen_score}
        isWinner={awayWon} isLive={isLive}
        dim={isFinished && !awayWon && homeWon}
      />
    </div>
  )
}

// ── SVG connector between two adjacent round columns ──────────────────────
// leftCount / rightCount: number of matches on each side.
// Draws the classic "H-fork" bracket lines.
const LINE = "rgba(255,255,255,.13)"

function Connector({ leftCount, rightCount }) {
  const lH  = TOTAL_H / leftCount
  const rH  = TOTAL_H / rightCount

  if (leftCount === rightCount) {
    // Straight connector (SF ↔ center)
    return (
      <svg width={CONN_W} height={TOTAL_H} style={{ flexShrink: 0 }} aria-hidden="true">
        {Array.from({ length: leftCount }, (_, i) => (
          <line key={i}
            x1={0} y1={(i + 0.5) * lH}
            x2={CONN_W} y2={(i + 0.5) * rH}
            stroke={LINE} strokeWidth="1.5" fill="none"
          />
        ))}
      </svg>
    )
  }

  const converging = leftCount > rightCount        // many-left → few-right
  const bigCount   = Math.max(leftCount, rightCount)
  const smallCount = Math.min(leftCount, rightCount)
  const bigH       = TOTAL_H / bigCount
  // Place junction at 1/3 from the big (outer) side so short stubs near R32
  // make convergence direction obvious; long single line goes toward center.
  const MX         = converging ? CONN_W / 3 : CONN_W * 2 / 3

  const segs = []
  for (let j = 0; j < smallCount; j++) {
    const b1 = (j * 2 + 0.5) * bigH
    const b2 = (j * 2 + 1.5) * bigH
    const mY = (b1 + b2) / 2

    if (converging) {
      // Big side LEFT → small side RIGHT
      segs.push(
        <line key={`a${j}`} x1={0}     y1={b1} x2={MX}     y2={b1} />,
        <line key={`b${j}`} x1={0}     y1={b2} x2={MX}     y2={b2} />,
        <line key={`c${j}`} x1={MX}    y1={b1} x2={MX}     y2={b2} />,
        <line key={`d${j}`} x1={MX}    y1={mY} x2={CONN_W} y2={mY} />,
      )
    } else {
      // Small side LEFT → big side RIGHT
      segs.push(
        <line key={`a${j}`} x1={0}     y1={mY} x2={MX}     y2={mY} />,
        <line key={`b${j}`} x1={MX}    y1={b1} x2={MX}     y2={b2} />,
        <line key={`c${j}`} x1={MX}    y1={b1} x2={CONN_W} y2={b1} />,
        <line key={`d${j}`} x1={MX}    y1={b2} x2={CONN_W} y2={b2} />,
      )
    }
  }

  return (
    <svg width={CONN_W} height={TOTAL_H} style={{ flexShrink: 0 }} aria-hidden="true">
      <g fill="none" stroke={LINE} strokeWidth="1.5">{segs}</g>
    </svg>
  )
}

// ── A column of matches for one round ───────────────────────────────────────
function RoundCol({ matches, count, onMatchClick, showPNum }) {
  return (
    <div style={{ width: CARD_W, height: TOTAL_H, flexShrink: 0, display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, i) => {
        const m = matches[i] ?? null
        return (
          <div key={m?.id ?? `e-${i}`}
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "3px 0" }}>
            <MatchCard
              match={m}
              onClick={() => m?.external_id && onMatchClick(m.external_id)}
              pLabel={showPNum && m?.bracket_pos ? pNum(m.bracket_pos) : null}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── Round label bar ──────────────────────────────────────────────────────────
function LabelBar({ labels }) {
  // labels: [{ text, w }, ...]  w = width in px (card or connector)
  return (
    <div style={{ display: "flex", minWidth: "max-content", paddingBottom: 10 }}>
      {labels.map((l, i) => (
        <div key={i} style={{
          width: l.w, flexShrink: 0, textAlign: "center",
          fontSize: "0.6rem", fontWeight: 700, letterSpacing: ".1em",
          textTransform: "uppercase", color: "var(--muted)",
        }}>
          {l.text || ""}
        </div>
      ))}
    </div>
  )
}

// ── Placeholder when no knockout data yet ────────────────────────────────────
function Placeholder() {
  const { t } = useTranslation()
  return (
    <div style={{ textAlign: "center", padding: "52px 0" }}>
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

// ── Main page ────────────────────────────────────────────────────────────────
export default function KnockoutPage() {
  const { t } = useTranslation()
  usePageMeta(
    t("bracket.knockoutStage"),
    "FIFA World Cup 2026 knockout bracket — Round of 32, Round of 16, Quarter Finals, Semi Finals and Final."
  )

  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  // Mobile: horizontal scroll. Desktop: auto-scale to fill width.
  const containerRef = useRef(null)
  const [scale, setScale]     = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const update = () => {
      const w = node.clientWidth - 16   // subtract 8px left + 8px right padding
      if (w <= MOBILE_BP) {
        setIsMobile(true)
        setScale(1)
      } else {
        setIsMobile(false)
        setScale(w >= BRACKET_W ? 1 : w / BRACKET_W)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const knockout = matches.filter(m => !m.group_stage)
  const hasData  = knockout.length > 0

  // FIFA 2026 WC bracket draw — exact visual slot order per round column.
  // These position arrays encode the seeding structure so adjacent pairs always
  // feed into the same next-round match via the H-fork SVG connector.
  const byPos = Object.fromEntries(knockout.map(m => [m.bracket_pos, m]))
  const slot  = p => byPos[p] ?? null

  const r32L = [2, 5, 1, 3, 11, 12, 9, 10].map(slot)
  const r32R = [4, 6, 7, 8, 14, 16, 13, 15].map(slot)
  const r16L = [17, 18, 21, 22].map(slot)
  const r16R = [19, 20, 23, 24].map(slot)
  const qfL  = [25, 26].map(slot)
  const qfR  = [27, 28].map(slot)
  const sfL  = [slot(29)]
  const sfR  = [slot(30)]
  const finalM = slot(32)
  const thirdM = slot(31)

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="site-section">
        <div className="container"><Placeholder /></div>
      </div>
    )
  }

  // Column label sequence (left → center → right)
  const leftLabels = [
    { text: t("bracket.r32"),           w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.r16"),           w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.quarterFinals"), w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.semiFinals"),    w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.final"),         w: CTR_W   },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.semiFinals"),    w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.quarterFinals"), w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.r16"),           w: CARD_W  },
    { text: "",                          w: CONN_W  },
    { text: t("bracket.r32"),           w: CARD_W  },
  ]

  // Approximate total bracket height for margin compensation when scaled
  const BRACKET_INNER_H = 36 + TOTAL_H + (thirdM ? 148 : 0)

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
      </div>

      {/* Full-width bracket — desktop: auto-scale; mobile: horizontal scroll */}
      <div ref={containerRef} style={{ width: "100%", padding: "0 8px", boxSizing: "border-box" }}>
        {/* scroll shell only on mobile */}
        <div style={isMobile ? { overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 16 } : {}}>
        <div style={isMobile ? { width: BRACKET_W } : {
          transformOrigin: "top left",
          transform: scale < 1 ? `scale(${scale})` : "none",
          width: BRACKET_W,
          marginBottom: scale < 1 ? `${-(BRACKET_INNER_H * (1 - scale))}px` : 0,
        }}>
          <LabelBar labels={leftLabels} />

          {/* ── Main bracket row ── */}
          <div style={{ display: "flex", alignItems: "stretch" }}>

            {/* LEFT: R32 → R16 → QF → SF */}
            <RoundCol matches={r32L} count={8} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={8} rightCount={4} />
            <RoundCol matches={r16L} count={4} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={4} rightCount={2} />
            <RoundCol matches={qfL}  count={2} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={2} rightCount={1} />
            <RoundCol matches={sfL}  count={1} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={1} rightCount={1} />

            {/* CENTER: Final */}
            <div style={{
              width: CTR_W, height: TOTAL_H, flexShrink: 0,
              display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center",
              gap: 8, padding: "0 14px",
              background: "linear-gradient(160deg, rgba(238,30,70,.07), transparent)",
              border: "1px solid rgba(238,30,70,.22)",
              borderRadius: 12,
            }}>
              <div style={{ fontSize: "1.9rem", filter: "drop-shadow(0 0 8px rgba(238,30,70,.4))" }}>🏆</div>
              <MatchCard
                match={finalM}
                onClick={() => finalM?.external_id && onMatchClick(finalM.external_id)}
                pLabel={finalM?.bracket_pos ? pNum(finalM.bracket_pos) : null}
              />
            </div>

            {/* RIGHT: SF → QF → R16 → R32 */}
            <Connector leftCount={1} rightCount={1} />
            <RoundCol matches={sfR}  count={1} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={1} rightCount={2} />
            <RoundCol matches={qfR}  count={2} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={2} rightCount={4} />
            <RoundCol matches={r16R} count={4} onMatchClick={onMatchClick} showPNum />
            <Connector leftCount={4} rightCount={8} />
            <RoundCol matches={r32R} count={8} onMatchClick={onMatchClick} showPNum />

          </div>

          {/* 3rd place */}
          {thirdM && (
            <div className="bk2-bronze">
              <div className="bk2-bronze__label">{t("bracket.thirdPlace")}</div>
              <div className="bk2-bronze__card">
                <MatchCard
                  match={thirdM}
                  onClick={() => thirdM?.external_id && onMatchClick(thirdM.external_id)}
                  pLabel={thirdM?.bracket_pos ? pNum(thirdM.bracket_pos) : null}
                />
              </div>
            </div>
          )}
        </div>
        </div>{/* end scroll shell */}
      </div>
    </div>
  )
}
