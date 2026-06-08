import { useParams, useNavigate, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMatches } from "../hooks/useMatches"
import MatchRow from "../components/MatchRow"
import { usePageMeta } from "../hooks/usePageMeta"

export default function GroupDetailPage() {
  const { t }      = useTranslation()
  const { group }  = useParams()
  usePageMeta(`Group ${group} — World Cup 2026`, `FIFA World Cup 2026 Group ${group} standings and match results.`)
  const navigate   = useNavigate()
  const onMatchClick = (m) => {
    if (m.external_id) navigate(`/matches/${m.external_id}`)
  }
  const [standings, setStandings] = useState([])

  const { matches, loading } = useMatches("all", { competition: "WC", group })

  useEffect(() => {
    fetch("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(data => setStandings((Array.isArray(data) ? data.filter(s => s.group_name === group) : data[group]) || []))
  }, [group])

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {/* Standings */}
          <div className="col-lg-5 mb-4">
            <div className="widget-next-match">
              <div className="widget-title"><h3>{t("groups.standings", { letter: group })}</h3></div>
              <div className="widget-body p-0" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table className="table custom-table mb-0" style={{ minWidth: 340 }}>
                  <thead>
                    <tr>
                      <th>{t("table.pos")}</th>
                      <th>{t("table.team")}</th>
                      <th>{t("table.played")}</th>
                      <th>{t("table.won")}</th>
                      <th>{t("table.drawn")}</th>
                      <th>{t("table.lost")}</th>
                      <th>{t("table.gd")}</th>
                      <th>{t("table.points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: "center", color: "gray", padding: "1.5rem" }}>{t("groups.noStandings")}</td></tr>
                    ) : standings.map((s, i) => {
                      const complete = standings.every(r => (r.played ?? 0) >= 3)
                      const a = complete ? 1 : 0.4
                      const bg = i === 0 ? `rgba(16,185,129,${0.1*a})` : i === 1 ? `rgba(16,185,129,${0.05*a})` : i === 2 ? `rgba(245,158,11,${0.05*a})` : `rgba(239,68,68,${0.04*a})`
                      const rankColor = i === 0 || i === 1 ? "#10b981" : i === 2 ? "#f59e0b" : "#666"
                      return (
                      <tr key={s.team.id} style={{ background: bg }}>
                        <td style={{ color: rankColor, fontWeight: 700 }}>{s.rank}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {s.team.flag_url && <img src={s.team.flag_url} alt="" className="flag-xs" />}
                            <Link to={`/teams/${s.team.id}`} style={{ color: "#fff", fontWeight: 700 }}>{s.team.name}</Link>
                          </div>
                        </td>
                        <td>{s.played}</td><td>{s.won}</td><td>{s.drawn}</td><td>{s.lost}</td>
                        <td style={{ color: s.goal_diff > 0 ? "#10b981" : s.goal_diff < 0 ? "#ef4444" : "inherit" }}>
                          {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                        </td>
                        <td><strong className="text-white">{s.points}</strong></td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Matches */}
          <div className="col-lg-7">
            <div className="widget-next-match">
              <div className="widget-title"><h3>{t("groups.matches", { letter: group })}</h3></div>
              <div className="widget-body p-0">
                {loading
                  ? <div className="loading-shimmer m-3" style={{ height: 200, borderRadius: 8 }} />
                  : matches.length === 0
                  ? <p style={{ color: "gray", textAlign: "center", padding: "2rem" }}>{t("noMatches")}</p>
                  : matches.map(m => <MatchRow key={m.id} match={m} showDate onClick={() => onMatchClick(m)} />)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
