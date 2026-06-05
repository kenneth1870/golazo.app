import { useNavigate } from "react-router-dom"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { formatMatchDate } from "../../hooks/useLocalTime"

export default function SchedulePage() {
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()

  const byDate = matches.reduce((acc, m) => {
    const d = formatMatchDate(m.kickoff_at)
    if (!acc[d]) acc[d] = []
    acc[d].push(m)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        {Object.entries(byDate).map(([date, dayMatches]) => (
          <div key={date} className="fixture-day">
            <div className="fixture-day__header">{date}</div>
            <div className="match-list">
              {dayMatches.map(m => (
                <MatchRow
                  key={m.id}
                  match={m}
                  onClick={m.external_id ? () => navigate(`/matches/${m.external_id}`) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
