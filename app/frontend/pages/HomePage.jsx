import { useNavigate } from "react-router-dom"
import { useMatches } from "../hooks/useMatches"
import Hero from "../components/Hero"
import MatchRow from "../components/MatchRow"

export default function HomePage() {
  const navigate = useNavigate()
  const { matches: live }     = useMatches("live", { competition: "WC" })
  const { matches: upcoming } = useMatches("upcoming", { competition: "WC" })
  const nextMatch = upcoming[0]

  return (
    <>
      <Hero nextMatch={nextMatch} onMatchSelect={id => navigate(`/scores/live`)} />

      {/* Live Now */}
      {live.length > 0 && (
        <section className="site-section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title"><span className="live-dot" />Live Now</h2>
              <a href="/scores/live" className="section-link" onClick={e => { e.preventDefault(); navigate("/scores/live") }}>View all →</a>
            </div>
            <div className="match-list">
              {live.slice(0, 3).map(m => (
                <MatchRow key={m.id} match={m} onClick={() => navigate(`/scores/live`)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Next Fixtures */}
      <section className="site-section bg-dark">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Upcoming Fixtures</h2>
            <a href="/scores/fixtures" className="section-link" onClick={e => { e.preventDefault(); navigate("/scores/fixtures") }}>Full schedule →</a>
          </div>
          <div className="match-list">
            {upcoming.slice(0, 5).map(m => (
              <MatchRow key={m.id} match={m} onClick={() => navigate(`/scores/fixtures`)} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
