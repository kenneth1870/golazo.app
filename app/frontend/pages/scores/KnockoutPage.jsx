import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { useNavigate } from "react-router-dom"

const KNOCKOUT_ROUNDS = ["Round of 16", "Quarter Final", "Semi Final", "3rd Place", "Final"]

export default function KnockoutPage() {
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()

  const knockout = matches.filter(m => !m.group_stage)
  const byRound  = KNOCKOUT_ROUNDS.reduce((acc, r) => {
    acc[r] = knockout.filter(m => m.round?.includes(r.replace(" ", " ")))
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  const hasData = knockout.length > 0

  return (
    <div className="site-section">
      <div className="container">
        {!hasData ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <h3>Knockout bracket not yet determined</h3>
            <p>Teams advance after the group stage ends on July 2, 2026</p>
          </div>
        ) : (
          KNOCKOUT_ROUNDS.map(round => byRound[round]?.length > 0 && (
            <div key={round} className="knockout-round">
              <div className="title-section"><h2 className="heading">{round}</h2></div>
              <div className="row">
                {byRound[round].map(m => (
                  <div key={m.id} className="col-lg-6">
                    <MatchRow match={m} onClick={() => {}} />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
