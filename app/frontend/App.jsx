import { useState } from "react"
import { useMatches } from "./hooks/useMatches"
import Navbar from "./components/Navbar"
import Hero from "./components/Hero"
import ScoreBoard from "./components/ScoreBoard"
import MatchDetail from "./components/MatchDetail"
import GroupStandings from "./components/GroupStandings"
import Footer from "./components/Footer"

export default function App() {
  const [activeTab, setActiveTab] = useState("home")
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const { matches } = useMatches("upcoming")

  const nextMatch = matches.find(m => m.status === "scheduled")

  const handleMatchSelect = (id) => {
    setSelectedMatchId(id)
    setActiveTab("matches")
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    if (tab !== "matches") setSelectedMatchId(null)
  }

  return (
    <div className="site-wrap">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />

      {selectedMatchId ? (
        <MatchDetail matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />
      ) : activeTab === "home" ? (
        <>
          <Hero nextMatch={nextMatch} onMatchSelect={handleMatchSelect} />
          <ScoreBoard onMatchSelect={handleMatchSelect} />
        </>
      ) : activeTab === "matches" ? (
        <>
          <div className="hero overlay" style={{ backgroundImage: "url('/images/bg_3.jpg')", minHeight: 260 }}>
            <div className="container">
              <div className="row align-items-center">
                <div className="col-lg-5 mx-auto text-center">
                  <h1 className="text-white">Matches</h1>
                  <p>Live scores, results, and upcoming fixtures for Mundial 2026.</p>
                </div>
              </div>
            </div>
          </div>
          <ScoreBoard onMatchSelect={handleMatchSelect} />
        </>
      ) : (
        <>
          <div className="hero overlay" style={{ backgroundImage: "url('/images/bg_2.jpg')", minHeight: 260 }}>
            <div className="container">
              <div className="row align-items-center">
                <div className="col-lg-5 mx-auto text-center">
                  <h1 className="text-white">Groups</h1>
                  <p>All 8 groups for FIFA World Cup 2026.</p>
                </div>
              </div>
            </div>
          </div>
          <GroupStandings />
        </>
      )}

      <Footer />
    </div>
  )
}
