import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"

// Official WC 2026 R32 seedings
const R32_SEEDS = [
  ["A1","B2"],["C1","D2"],["E1","F2"],["G1","H2"],
  ["I1","J2"],["K1","L2"],["B1","A2"],["D1","C2"],
  ["F1","E2"],["H1","G2"],["J1","I2"],["L1","K2"],
  ["T1","T2"],["T3","T4"],["T5","T6"],["T7","T8"],
]

const ROUND_LABELS = ["R32","Round of 16","Quarter Finals","Semi Finals","Final"]
const ROUND_SIZES  = [16, 8, 4, 2, 1]

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

  const rounds = [r32]
  let prev = r32, startId = 16

  for (const size of ROUND_SIZES.slice(1)) {
    const round = Array.from({ length: size }, (_, i) => {
      const m1    = prev[i * 2]
      const m2    = prev[i * 2 + 1]
      const team1 = m1?.winner || null
      const team2 = m2?.winner || null
      const pick  = picks[startId + i]
      return {
        id: startId + i, team1, team2, pick,
        winner: pick !== undefined && team1 && team2 ? (pick === 0 ? team1 : team2) : null,
      }
    })
    rounds.push(round)
    prev = round
    startId += size
  }
  return rounds
}

function TeamButton({ team, isWinner, isPicked, onClick, disabled }) {
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
      title={team.resolved ? team.name : `Slot: ${team.name}`}
    >
      {team.flag_url
        ? <img src={team.flag_url} alt="" className="flag-xs" loading="lazy" onError={e => (e.target.style.display = "none")} />
        : <span className="pred-team__dot" />
      }
      <span className="pred-team__name">{team.name || "?"}</span>
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
  usePageMeta("Bracket Predictor", "Pick your FIFA World Cup 2026 champion — fill out the knockout bracket and share your prediction.")
  const [searchParams, setSearchParams] = useSearchParams()
  const [standings, setStandings] = useState({})
  const [picks, setPicks] = useState(() => decodePicks(searchParams.get("p")))
  const [copied, setCopied] = useState(false)
  const [champion, setChampion] = useState(null)

  useEffect(() => {
    fetchWithTimeout("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(setStandings)
      .catch(() => {})
  }, [])

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
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", fontWeight: 800 }}>Bracket Predictor</h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.82rem" }}>
              Click a team to advance them. Picks are saved in the URL.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {totalPicks > 0 && (
              <button onClick={reset} style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--muted)", padding: "8px 14px", cursor: "pointer", fontSize: "0.78rem",
              }}>
                Reset
              </button>
            )}
            <button onClick={share} style={{
              background: "var(--accent,#ee1e46)", border: "none", borderRadius: 8,
              color: "#fff", padding: "8px 16px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700,
            }}>
              {copied ? "✓ Copied!" : "Share"}
            </button>
          </div>
        </div>

        {/* Champion banner */}
        {champion && (
          <div style={{
            background: "linear-gradient(135deg,rgba(238,30,70,.15),rgba(245,158,11,.12))",
            border: "1px solid rgba(245,158,11,.3)", borderRadius: 12,
            padding: "14px 20px", marginBottom: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ fontSize: "1.5rem" }}>🏆</span>
            <div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Your Champion</div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#f59e0b" }}>{champion.name}</div>
            </div>
          </div>
        )}

        {/* Bracket */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
          <div style={{ display: "flex", gap: 12, minWidth: "max-content", paddingBottom: 16 }}>
            {rounds.map((round, ri) => (
              <div key={ri} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{
                  fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)",
                  textTransform: "uppercase", letterSpacing: ".08em",
                  padding: "0 4px 10px", textAlign: "center",
                }}>
                  {ROUND_LABELS[ri]}
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

        <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: 16, textAlign: "center" }}>
          {totalPicks} / 31 matches picked · Notifications fire while the app is open
        </p>
      </div>
    </div>
  )
}
