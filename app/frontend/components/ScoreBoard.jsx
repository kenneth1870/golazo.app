import { useState } from "react"
import { useMatches } from "../hooks/useMatches"
import MatchCard from "./MatchCard"

const FILTERS = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All" },
]

export default function ScoreBoard({ onMatchSelect }) {
  const [filter, setFilter] = useState("live")
  const { matches, loading, error } = useMatches(filter)

  return (
    <div className="scoreboard">
      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`filter-tab ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.key === "live" && matches.filter(m => m.status === "live").length > 0 && (
              <span className="live-dot" />
            )}
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Loading matches...</div>}
      {error && <div className="error">Error: {error}</div>}

      {!loading && matches.length === 0 && (
        <div className="empty">No matches found</div>
      )}

      <div className="matches-grid">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} onClick={() => onMatchSelect(match.id)} />
        ))}
      </div>
    </div>
  )
}
