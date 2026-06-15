import { useState, useMemo } from "react"
import { useMatches } from "../hooks/useMatches"
import MatchCard from "./MatchCard"
import UpcomingMatchWidget from "./UpcomingMatchWidget"

const FILTERS = [
  { key: "live",     label: "Live" },
  { key: "today",    label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all",      label: "All Matches" },
]

const WC_GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"]

export default function ScoreBoard({ onMatchSelect, competition = "WC" }) {
  const [filter, setFilter] = useState("all")
  const [group, setGroup]   = useState(null)

  const { matches, loading, error } = useMatches(filter, { competition, group })

  const liveMatches     = useMemo(() => matches.filter(m => m.status === "live"),     [matches])
  const finishedMatches = useMemo(() => matches.filter(m => m.status === "finished"), [matches])
  const upcomingMatches = useMemo(() => matches.filter(m => m.status === "scheduled"),[matches])
  const liveCount       = liveMatches.length

  return (
    <>
      {/* Filters */}
      <div className="site-section" style={{ paddingTop: 24, paddingBottom: 0 }}>
        <div className="container">

          {/* Status filter */}
          <div className="filter-tabs mb-2">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-tab${filter === f.key ? " active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.key === "live" && liveCount > 0 && <span className="live-indicator" />}
                {f.label}
              </button>
            ))}
          </div>

          {/* Group filter */}
          <div className="filter-tabs">
            <button
              className={`filter-tab${!group ? " active" : ""}`}
              onClick={() => setGroup(null)}
            >
              All Groups
            </button>
            {WC_GROUPS.map(g => (
              <button
                key={g}
                className={`filter-tab${group === g ? " active" : ""}`}
                onClick={() => setGroup(g)}
              >
                Group {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="site-section">
          <div className="container">
            {[1,2,3].map(i => (
              <div key={i} className="loading-shimmer mb-3" style={{ height: 140, borderRadius: 10 }} />
            ))}
          </div>
        </div>
      )}
      {error && (
        <div className="site-section">
          <div className="container">
            <p className="text-center text-danger">Error loading matches</p>
          </div>
        </div>
      )}

      {/* Live */}
      {!loading && liveMatches.length > 0 && (
        <div className="container">
          <div className="row">
            <div className="col-12 title-section mt-4">
              <h2 className="heading"><span className="live-indicator" />Live Now</h2>
            </div>
          </div>
          <div className="row">
            {liveMatches.map(m => (
              <div key={m.id} className="col-lg-12">
                <MatchCard match={m} onClick={() => onMatchSelect(m.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && finishedMatches.length > 0 && (
        <div className="container">
          <div className="row">
            <div className="col-12 title-section mt-4">
              <h2 className="heading">Results</h2>
            </div>
          </div>
          <div className="row">
            {finishedMatches.map(m => (
              <div key={m.id} className="col-lg-6">
                <MatchCard match={m} onClick={() => onMatchSelect(m.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {!loading && upcomingMatches.length > 0 && (
        <div className="site-section bg-dark">
          <div className="container">
            <div className="row">
              <div className="col-12 title-section">
                <h2 className="heading">Upcoming Matches</h2>
              </div>
            </div>
            <div className="row">
              {upcomingMatches.map(m => (
                <div key={m.id} className="col-lg-6">
                  <UpcomingMatchWidget match={m} onClick={() => onMatchSelect(m.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="site-section">
          <div className="container">
            <p className="text-center" style={{ color: "gray", padding: "3rem 0" }}>No matches found</p>
          </div>
        </div>
      )}
    </>
  )
}
