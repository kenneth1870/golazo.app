import { useNavigate } from "react-router-dom"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { formatMatchDate } from "../../hooks/useLocalTime"

export default function FixturesPage() {
  const { matches, loading } = useMatches("upcoming", { competition: "WC" })
  const navigate = useNavigate()

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  // Group by date
  const byDate = matches.reduce((acc, m) => {
    const d = formatMatchDate(m.kickoff_at)
    if (!acc[d]) acc[d] = []
    acc[d].push(m)
    return acc
  }, {})

  return (
    <div className="site-section">
      <div className="container">
        {Object.entries(byDate).map(([date, dayMatches]) => (
          <div key={date} className="fixture-day">
            <div className="fixture-day__header">{date}</div>
            <div className="match-list">
              {dayMatches.map(m => (
                <MatchRow key={m.id} match={m} onClick={() => navigate(`/scores/fixtures`)} />
              ))}
            </div>
          </div>
        ))}
        {matches.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">📅</div>
            <h3>No upcoming fixtures</h3>
          </div>
        )}
      </div>
    </div>
  )
}
