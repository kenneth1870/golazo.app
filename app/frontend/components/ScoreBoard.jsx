import { useState } from "react"
import { useMatches } from "../hooks/useMatches"
import MatchCard from "./MatchCard"
import UpcomingMatchWidget from "./UpcomingMatchWidget"

const FILTERS = [
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "all", label: "All Matches" },
]

export default function ScoreBoard({ onMatchSelect }) {
  const [filter, setFilter] = useState("all")
  const { matches, loading, error } = useMatches(filter)

  const liveMatches = matches.filter(m => m.status === "live")
  const finishedMatches = matches.filter(m => m.status === "finished")
  const upcomingMatches = matches.filter(m => m.status === "scheduled")

  return (
    <>
      {/* Filter tabs */}
      <div className="site-section" style={{ paddingTop: "30px", paddingBottom: 0 }}>
        <div className="container">
          <div className="filter-tabs">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`filter-tab${filter === f.key ? " active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.key === "live" && liveMatches.length > 0 && <span className="live-indicator" />}
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="site-section">
          <div className="container">
            <p className="text-center" style={{ color: "gray", padding: "3rem 0" }}>Loading matches...</p>
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

      {/* Live matches — full team-vs cards */}
      {!loading && liveMatches.length > 0 && (
        <div className="container">
          <div className="row">
            <div className="col-12 title-section mt-4">
              <h2 className="heading">
                <span className="live-indicator" />
                Live Now
              </h2>
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

      {/* Finished matches */}
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

      {/* Upcoming matches — widget cards */}
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
