import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"

// Official FIFA 2026 R32 pairings — mirrors WorldCupKnockout::R32_SLOTS.
// Slot codes use predictor format: A1 = 1st in group A, A2 = 2nd, T1–T8 = 3rd-placed.
const R32_SEEDS = [
  ["A2","B2"],["E1","T1"],["F1","C2"],["C1","F2"],
  ["I1","T2"],["E2","I2"],["A1","T3"],["L1","T4"],
  ["D1","T5"],["G1","T6"],["K2","L2"],["H1","J2"],
  ["B1","T7"],["J1","H2"],["K1","T8"],["D2","G2"],
]

// Cross-bracket pairings for later rounds (0-based indices into previous round).
const R16_PAIRINGS = [[1,4],[0,2],[3,5],[6,7],[10,11],[8,9],[13,15],[12,14]]
const QF_PAIRINGS  = [[0,1],[4,5],[2,3],[6,7]]
const SF_PAIRINGS  = [[0,1],[2,3]]
const FINAL_PAIRING = [0, 1]

const ROUND_LABEL_KEYS = ["bracket.r32","bracket.roundOf16","bracket.quarterFinals","bracket.semiFinals","bracket.final"]
const ROUND_SIZES = [16, 8, 4, 2, 1]

function seedLabel(slot) {
  const m = slot.match(/^([A-L])([12])$/)
  if (m) return `${m[2] === "1" ? "1st" : "2nd"} Grp ${m[1]}`
  if (slot.startsWith("T")) return `3rd #${slot[1]}`
  return slot
}

function resolveTeam(slot, standings) {
  const m = slot.match(/^([A-L])([12])$/)
  if (m) {
    const team = standings?.[m[1]]?.[parseInt(m[2]) - 1]?.team
    if (team?.name) return { ...team, resolved: true }
  }
  return { name: seedLabel(slot), flag_url: null, resolved: false }
}

// Encode picks (array of 0|1|undefined, len 31) to compact URL-safe string
function encodePicks(picks) {
  const s = Array.from({ length: 31 }, (_, i) => picks[i] !== undefined ? String(picks[i]) : "_").join("")
  return btoa(s).replace(/=+$/, "")
}

function decodePicks(str) {
  if (!str) return {}
  try {
    const pad = str + "=".repeat((4 - str.length % 4) % 4)
    return Object.fromEntries(
      atob(pad).split("").map((c, i) => [i, c === "_" ? undefined : Number(c)]).filter(([, v]) => v !== undefined)
    )
  } catch { return {} }
}

function buildBracket(standings, picks) {
  const r32 = R32_SEEDS.map(([s1, s2], i) => {
    const team1 = resolveTeam(s1, standings)
    const team2 = resolveTeam(s2, standings)
    const pick  = picks[i]
    return { id: i, team1, team2, pick, winner: pick !== undefined ? (pick === 0 ? team1 : team2) : null }
  })

  function nextRound(prev, pairings, startId) {
    return pairings.map(([i, j], idx) => {
      const m1    = prev[i]
      const m2    = prev[j]
      const team1 = m1?.winner || null
      const team2 = m2?.winner || null
      const pick  = picks[startId + idx]
      return {
        id: startId + idx, team1, team2, pick,
        winner: pick !== undefined && team1 && team2 ? (pick === 0 ? team1 : team2) : null,
      }
    })
  }

  const r16   = nextRound(r32, R16_PAIRINGS, 16)
  const qf    = nextRound(r16, QF_PAIRINGS, 24)
  const sf    = nextRound(qf, SF_PAIRINGS, 28)
  const final = nextRound(sf, [FINAL_PAIRING], 30)
  return [r32, r16, qf, sf, final]
}

function TeamButton({ team, isWinner, isPicked, onClick, disabled }) {
  const { i18n } = useTranslation()
  if (!team) {
    return (
      <div className="pred-team pred-team--tbd">
        <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>TBD</span>
      </div>
    )
  }
  return (
    <button
      className={`pred-team${isPicked ? " pred-team--picked" : ""}${isWinner ? " pred-team--winner" : ""}`}
      onClick={onClick}
      disabled={disabled || !team.name}
      aria-pressed={isPicked}
      title={team.resolved ? team.name : `Slot: ${team.name}`}
    >
      {team.flag_url
        ? <img src={team.flag_url} alt={team.name} className="flag-xs" loading="eager" onError={e => (e.target.style.display = "none")} />
        : <span className="pred-team__dot" />
      }
      <span className="pred-team__name">{translateTeam(team.name, i18n.language) || "?"}</span>
    </button>
  )
}

function MatchCard({ match, onPick, roundIdx }) {
  const { id, team1, team2, pick } = match
  const bothKnown = team1 && team2

  return (
    <div className={`pred-match${bothKnown ? "" : " pred-match--pending"}`}>
      <TeamButton
        team={team1}
        isPicked={pick === 0}
        onClick={() => onPick(id, 0)}
        disabled={!bothKnown}
      />
      <div className="pred-match__vs">vs</div>
      <TeamButton
        team={team2}
        isPicked={pick === 1}
        onClick={() => onPick(id, 1)}
        disabled={!bothKnown}
      />
    </div>
  )
}

export default function BracketPredictorPage() {
  const { t } = useTranslation()
  usePageMeta(t("bracket.title"), t("bracket.metaDesc"))
  const [searchParams, setSearchParams] = useSearchParams()
  const [standings, setStandings] = useState({})
  const [standingsLoading, setStandingsLoading] = useState(true)
  const [standingsError, setStandingsError] = useState(false)
  const [picks, setPicks] = useState(() => decodePicks(searchParams.get("p")))
  const [copied, setCopied] = useState(false)
  const [champion, setChampion] = useState(null)

  const loadStandings = useCallback(() => {
    setStandingsLoading(true)
    setStandingsError(false)
    fetchWithTimeout("/api/v1/standings?competition=WC")
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(setStandings)
      .catch(() => setStandingsError(true))
      .finally(() => setStandingsLoading(false))
  }, [])

  useEffect(() => { loadStandings() }, [loadStandings])

  const rounds = buildBracket(standings, picks)

  // Track champion
  useEffect(() => {
    const final = rounds[4]?.[0]
    setChampion(final?.winner || null)
  }, [picks, standings])

  const handlePick = useCallback((matchId, side) => {
    setPicks(prev => {
      const next = { ...prev }
      // If re-clicking the same pick, clear it and all downstream
      if (next[matchId] === side) {
        // Clear this match and all that depend on it
        clearDownstream(next, matchId)
        delete next[matchId]
      } else {
        // Clear downstream picks for this match before changing
        clearDownstream(next, matchId)
        next[matchId] = side
      }
      setSearchParams({ p: encodePicks(next) }, { replace: true })
      return next
    })
  }, [setSearchParams])

  function clearDownstream(picks, matchId) {
    // Find all matches in later rounds that depend on this match's winner
    // A match at index i feeds into: floor((i - roundStart(i)) / 2) + roundStart(nextRound)
    let current = [matchId]
    for (let ri = 0; ri < ROUND_SIZES.length - 1; ri++) {
      const startId = ROUND_SIZES.slice(0, ri).reduce((a, b) => a + b, 0)
      const nextStartId = startId + ROUND_SIZES[ri]
      const nextIds = current.map(id => {
        const localIdx = id - startId
        if (localIdx < 0 || localIdx >= ROUND_SIZES[ri]) return null
        return nextStartId + Math.floor(localIdx / 2)
      }).filter(Boolean)
      nextIds.forEach(id => delete picks[id])
      current = nextIds
    }
  }

  const share = () => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: "My WC 2026 Bracket Prediction — Golazo", url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const reset = () => {
    setPicks({})
    setSearchParams({}, { replace: true })
  }

  const totalPicks = Object.keys(picks).length

  return (
    <div className="site-section">
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 800 }}>{t("bracket.title")}</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
              {t("bracket.subtitle")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {totalPicks > 0 && (
              <button onClick={reset} style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--muted)", padding: "8px 14px", cursor: "pointer", fontSize: "0.78rem",
              }}>
                {t("bracket.reset")}
              </button>
            )}
            <button onClick={share} style={{
              background: "var(--accent)", border: "none", borderRadius: 8,
              color: "#fff", padding: "8px 16px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
            }}>
              {copied ? t("bracket.copied") : t("bracket.share")}
            </button>
          </div>
        </div>

        {/* Champion banner */}
        {champion && (
          <div
            aria-live="polite"
            style={{
            background: "linear-gradient(135deg,rgba(238,30,70,.15),rgba(245,158,11,.12))",
            border: "1px solid rgba(245,158,11,.3)", borderRadius: 12,
            padding: "14px 20px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "1.5rem" }}>🏆</span>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{t("bracket.yourChampion")}</div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#f59e0b" }}>{champion.name}</div>
            </div>
          </div>
        )}

        {/* Bracket */}
        {standingsError ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.tryAgain")}</p>
            <button className="btn btn-primary btn-sm" onClick={loadStandings}>{t("error.retry")}</button>
          </div>
        ) : standingsLoading ? (
          <div style={{ display: "flex", gap: 12, overflow: "hidden" }}>
            {[16, 8, 4, 2, 1].map((count, ri) => (
              <div key={ri} style={{ display: "flex", flexDirection: "column", gap: 6, flex: `0 0 ${ri === 4 ? 100 : 160}px` }}>
                <div className="loading-shimmer" style={{ height: 12, borderRadius: 4, marginBottom: 6 }} />
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="loading-shimmer" style={{ height: 52, borderRadius: 10 }} />
                ))}
              </div>
            ))}
          </div>
        ) : null}
        {!standingsError && (
        <>
        <div className="bracket-scroll-hint d-md-none" aria-hidden="true">
          <span>←</span> {t("bracket.swipeHint")} <span>→</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, display: standingsLoading ? "none" : undefined }}>
          <div style={{ display: "flex", gap: 12, minWidth: "max-content", paddingBottom: 16 }} role="list" aria-label={t("bracket.title")}>
            {rounds.map((round, ri) => (
              <div key={ri} role="listitem" aria-label={t(ROUND_LABEL_KEYS[ri])} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{
                  fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)",
                  textTransform: "uppercase", letterSpacing: ".08em",
                  padding: "0 4px 10px", textAlign: "center",
                }}>
                  {t(ROUND_LABEL_KEYS[ri])}
                </div>
                <div style={{
                  display: "flex", flexDirection: "column",
                  justifyContent: "space-around",
                  flex: 1, gap: ri === 0 ? 6 : 0,
                  minHeight: ri === 0 ? "auto" : `${16 * Math.pow(2, ri) * 52}px`,
                }}>
                  {round.map(match => (
                    <div key={match.id} style={{
                      display: "flex", alignItems: "center",
                      height: ri === 0 ? "auto" : `${Math.pow(2, ri) * 52}px`,
                    }}>
                      <MatchCard match={match} onPick={handlePick} roundIdx={ri} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}

        {!standingsError && (
        <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: 16, textAlign: "center" }}>
          {t("bracket.matchesPicked", { count: totalPicks })}
        </p>
        )}
      </div>
    </div>
  )
}
