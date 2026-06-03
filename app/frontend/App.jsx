import { useState } from "react"
import ScoreBoard from "./components/ScoreBoard"
import MatchDetail from "./components/MatchDetail"
import GroupStandings from "./components/GroupStandings"

export default function App() {
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const [activeTab, setActiveTab] = useState("scores")

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚽</span>
            <span className="logo-text">GOLAZO</span>
            <span className="logo-sub">Mundial 2026</span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${activeTab === "scores" ? "active" : ""}`}
              onClick={() => { setActiveTab("scores"); setSelectedMatchId(null) }}
            >
              Live Scores
            </button>
            <button
              className={`nav-btn ${activeTab === "groups" ? "active" : ""}`}
              onClick={() => { setActiveTab("groups"); setSelectedMatchId(null) }}
            >
              Groups
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        {selectedMatchId ? (
          <MatchDetail matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />
        ) : activeTab === "scores" ? (
          <ScoreBoard onMatchSelect={setSelectedMatchId} />
        ) : (
          <GroupStandings />
        )}
      </main>
    </div>
  )
}
