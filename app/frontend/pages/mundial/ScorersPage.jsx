import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../../hooks/usePageMeta"

export default function ScorersPage() {
  const { t } = useTranslation()
  usePageMeta(t("mundial.scorersTitle"), "Top scorers at FIFA World Cup 2026 — goals, assists and games played.")
  const [scorers, setScorers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/top_scorers?competition=WC")
      .then(r => r.json())
      .then(setScorers)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        {scorers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚽</div>
            <h3>{t("mundial.noScorers")}</h3>
            <p>{t("mundial.scorersAppear")}</p>
          </div>
        ) : (
          <div className="widget-next-match">
            <div className="widget-title"><h3>{t("mundial.scorersTitle")}</h3></div>
            <div className="widget-body p-0">
              <table className="table custom-table mb-0">
                <thead>
                  <tr>
                    <th>{t("table.pos")}</th>
                    <th>{t("table.player")}</th>
                    <th>{t("table.team")}</th>
                    <th>{t("table.goals")}</th>
                    <th>{t("table.assists")}</th>
                    <th>{t("table.played")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scorers.map((s, i) => (
                    <tr key={i}>
                      <td><strong className="text-white">{i + 1}</strong></td>
                      <td>
                        <strong className="text-white">{s.player?.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "gray" }}>{s.player?.nationality}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {s.team?.crest && <img src={s.team.crest} alt="" className="logo-sm" loading="eager" />}
                          <span>{s.team?.name}</span>
                        </div>
                      </td>
                      <td><strong className="text-white" style={{ fontSize: "1.1rem" }}>{s.goals ?? 0}</strong></td>
                      <td>{s.assists ?? 0}</td>
                      <td>{s.played ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
