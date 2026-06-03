import { useState } from "react"
import { useMatches } from "./hooks/useMatches"
import Navbar         from "./components/Navbar"
import Hero           from "./components/Hero"
import ScoreBoard     from "./components/ScoreBoard"
import TodayMatches   from "./components/TodayMatches"
import MatchDetail    from "./components/MatchDetail"
import GroupStandings from "./components/GroupStandings"
import Footer         from "./components/Footer"

const HERO_BG = {
  home:    "/images/bg_3.jpg",
  today:   "/images/bg_1.jpg",
  matches: "/images/bg_3.jpg",
  bracket: "/images/bg_2.jpg",
  groups:  "/images/bg_2.jpg",
  scorers: "/images/bg_1.jpg",
}

const PAGE_TITLE = {
  today:   { h1: "Today",        sub: "Live scores and today's fixtures across all competitions" },
  matches: { h1: "Matches",      sub: "Live scores, results, and upcoming WC 2026 fixtures" },
  bracket: { h1: "Bracket",      sub: "FIFA World Cup 2026 knockout stage" },
  groups:  { h1: "Group Stage",  sub: "Standings for all 12 groups — FIFA World Cup 2026" },
  scorers: { h1: "Top Scorers",  sub: "Leading goalscorers at the FIFA World Cup 2026" },
}

function PageHero({ tab }) {
  const { h1, sub } = PAGE_TITLE[tab] || {}
  return (
    <div className="hero overlay" style={{ backgroundImage: `url('${HERO_BG[tab]}')`, minHeight: 240 }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-6 mx-auto text-center">
            <h1 className="text-white">{h1}</h1>
            <p>{sub}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab]         = useState("home")
  const [selectedMatchId, setSelectedMatchId] = useState(null)
  const { matches } = useMatches("upcoming", { competition: "WC" })
  const nextMatch = matches.find(m => m.status === "scheduled")

  const handleMatchSelect = id => {
    setSelectedMatchId(id)
    setActiveTab("matches")
  }

  const handleTabChange = tab => {
    setActiveTab(tab)
    if (tab !== "matches") setSelectedMatchId(null)
  }

  const renderContent = () => {
    if (selectedMatchId) {
      return <MatchDetail matchId={selectedMatchId} onBack={() => setSelectedMatchId(null)} />
    }

    switch (activeTab) {
      case "home":
        return (
          <>
            <Hero nextMatch={nextMatch} onMatchSelect={handleMatchSelect} />
            <ScoreBoard onMatchSelect={handleMatchSelect} />
          </>
        )
      case "today":
        return (
          <>
            <PageHero tab="today" />
            <TodayMatches onMatchSelect={handleMatchSelect} />
          </>
        )
      case "matches":
        return (
          <>
            <PageHero tab="matches" />
            <ScoreBoard onMatchSelect={handleMatchSelect} />
          </>
        )
      case "bracket":
        return (
          <>
            <PageHero tab="bracket" />
            <div className="site-section">
              <div className="container">
                <div className="widget-next-match">
                  <div className="widget-title"><h3>Knockout Bracket</h3></div>
                  <div className="widget-body text-center py-5">
                    <p style={{ color: "gray" }}>Bracket will populate after group stage completes (July 2, 2026)</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      case "groups":
        return (
          <>
            <PageHero tab="groups" />
            <GroupStandings />
          </>
        )
      case "scorers":
        return (
          <>
            <PageHero tab="scorers" />
            <div className="site-section">
              <div className="container">
                <div className="widget-next-match">
                  <div className="widget-title"><h3>Top Scorers — WC 2026</h3></div>
                  <div className="widget-body text-center py-5">
                    <p style={{ color: "gray" }}>Scorers will appear once the tournament begins (June 11, 2026)</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="site-wrap">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} />
      {renderContent()}
      <Footer />
    </div>
  )
}
