import { useNavigate } from "react-router-dom"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function GroupStagePage() {
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()

  const groupMatches = matches.filter(m => m.group_stage)
  const byGroup = GROUPS.reduce((acc, g) => {
    acc[g] = groupMatches.filter(m => m.group_stage === g)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {GROUPS.filter(g => byGroup[g].length > 0).map(g => (
            <div key={g} className="col-lg-6 mb-4">
              <div className="group-matches-card">
                <div className="group-matches-card__header">
                  <span>Group {g}</span>
                  <button className="group-link" onClick={() => navigate(`/groups/${g}`)}>
                    Standings →
                  </button>
                </div>
                <div className="match-list match-list--compact">
                  {byGroup[g].map(m => (
                    <MatchRow key={m.id} match={m} onClick={() => navigate(`/groups/${g}`)} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
