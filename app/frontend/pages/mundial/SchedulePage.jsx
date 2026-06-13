import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { formatMatchDate } from "../../hooks/useLocalTime"
import { usePageMeta } from "../../hooks/usePageMeta"

export default function SchedulePage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("mundial.scheduleTitle"), "Full FIFA World Cup 2026 schedule — all 104 matches, kickoff times and venues.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()

  const byDate = matches.reduce((acc, m) => {
    const d = formatMatchDate(m.kickoff_at, i18n.language)
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
