import { useNavigate } from "react-router-dom"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"

export default function ResultsPage() {
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const finished = matches.filter(m => m.status === "finished")
    .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        {finished.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <h3>No results yet</h3>
            <p>Results will appear here once matches are played</p>
          </div>
        ) : (
          <div className="match-list">
            {finished.map(m => (
              <MatchRow key={m.id} match={m} showDate onClick={() => navigate(`/scores/results`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
