import { useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { useMatches } from "../../hooks/useMatches"
import MatchCard from "../../components/MatchCard"

export default function LivePage() {
  const { matches, loading } = useMatches("live")
  const [globalLive, setGlobalLive] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch("/api/v1/live_scores")
      .then(r => r.json())
      .then(setGlobalLive)
      .catch(() => {})
    const iv = setInterval(() => {
      fetch("/api/v1/live_scores").then(r => r.json()).then(setGlobalLive).catch(() => {})
    }, 30000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="site-section">
      <div className="container">

        {/* WC Live */}
        {!loading && (
          <>
            {matches.length > 0 ? (
              <>
                <div className="title-section"><h2 className="heading"><span className="live-dot" />WC 2026 — Live</h2></div>
                <div className="row">
                  {matches.map(m => (
                    <div key={m.id} className="col-lg-6">
                      <MatchCard match={m} onClick={() => navigate(`/scores/live`)} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__icon">⚽</div>
                <h3>No WC matches live right now</h3>
                <p>World Cup 2026 begins June 11, 2026</p>
              </div>
            )}
          </>
        )}

        {/* Global live from all leagues */}
        {globalLive.length > 0 && (
          <>
            <div className="title-section mt-5"><h2 className="heading">All Leagues — Live Now ({globalLive.length})</h2></div>
            <div className="global-live-list">
              {globalLive.map((m, i) => (
                <div key={i} className="global-live-row">
                  <div className="global-live-row__time">{m.minute || "LIVE"}</div>
                  <div className="global-live-row__teams">
                    <span>{m.home?.name}</span>
                    <span className="score-pill score-pill--live">{m.home?.score} – {m.away?.score}</span>
                    <span>{m.away?.name}</span>
                  </div>
                  {m.away?.red_cards > 0 && <span className="red-card-badge">🟥 ×{m.away.red_cards}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
