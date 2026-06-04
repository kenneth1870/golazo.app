import { useMatches } from "../../hooks/useMatches"
import { useNavigate } from "react-router-dom"

// WC 2026: R32 → R16 → QF → SF → Final (+ 3rd place)
const ROUNDS = [
  { key: "Round of 32",    label: "R32",        count: 16 },
  { key: "Round of 16",   label: "R16",         count: 8  },
  { key: "Quarter Final", label: "Quarter Finals", count: 4  },
  { key: "Semi Final",    label: "Semi Finals",  count: 2  },
  { key: "Final",         label: "Final",        count: 1  },
]
const THIRD_PLACE = "3rd Place"

function MatchSlot({ match, onClick }) {
  const isLive     = match?.status === "live"
  const isFinished = match?.status === "finished"
  const hasScore   = match?.home_score !== null && match?.away_score !== null

  if (!match) {
    return (
      <div className="bracket-slot bracket-slot--empty">
        <span className="bracket-slot__tbd">TBD</span>
      </div>
    )
  }

  return (
    <div
      className={`bracket-slot${isLive ? " bracket-slot--live" : ""}${isFinished ? " bracket-slot--finished" : ""}`}
      onClick={match.external_id ? onClick : undefined}
      style={{ cursor: match.external_id ? "pointer" : "default" }}
    >
      <div className="bracket-slot__team">
        {match.home_team?.flag_url && (
          <img src={match.home_team.flag_url} alt="" className="flag-xs"
            onError={e => (e.target.style.display = "none")} />
        )}
        <span className={`bracket-slot__name${isFinished && match.home_score > match.away_score ? " bracket-slot__name--winner" : ""}`}>
          {match.home_team?.name ?? "TBD"}
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
        <span className={`bracket-slot__name${isFinished && match.away_score > match.home_score ? " bracket-slot__name--winner" : ""}`}>
          {match.away_team?.name ?? "TBD"}
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

function PlaceholderBracket() {
  return (
    <div className="bracket-placeholder">
      <div className="bracket-placeholder__icon">🏆</div>
      <h3>Knockout bracket not yet determined</h3>
      <p style={{ color: "#888", fontSize: "0.85rem", maxWidth: 340, margin: "0 auto" }}>
        The 32 teams that advance from the group stage will appear here after July 2, 2026
      </p>
      <div className="bracket-preview">
        {ROUNDS.map(r => (
          <div key={r.key} className="bracket-preview__round">
            <div className="bracket-preview__label">{r.label}</div>
            <div className="bracket-preview__slots">
              {Array.from({ length: r.count }).map((_, i) => (
                <div key={i} className="bracket-preview__slot" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function KnockoutPage() {
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const onMatchClick = (extId) => navigate(`/matches/${extId}`)

  const knockout   = matches.filter(m => !m.group_stage)
  const hasData    = knockout.length > 0

  const byRound = ROUNDS.reduce((acc, r) => {
    acc[r.key] = knockout.filter(m => m.round?.toLowerCase().includes(r.key.toLowerCase()))
    return acc
  }, {})
  const thirdPlace = knockout.filter(m => m.round?.toLowerCase().includes("3rd") || m.round?.toLowerCase().includes("third"))

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
        <div className="bracket-scroll-wrap">
          <div className="bracket">
            {ROUNDS.map(r => (
              <RoundColumn
                key={r.key}
                label={r.label}
                matches={byRound[r.key]}
                count={r.count}
                onMatchClick={onMatchClick}
              />
            ))}
          </div>
        </div>

        {thirdPlace.length > 0 && (
          <div className="bracket-third-place">
            <div className="bracket-round__label" style={{ marginBottom: 8 }}>3rd Place</div>
            <div style={{ maxWidth: 260, margin: "0 auto" }}>
              <MatchSlot match={thirdPlace[0]} onClick={() => onMatchClick(thirdPlace[0].external_id)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
