import { useState, useEffect } from "react"
import { fetchJson } from "../../utils/fetchJson"

export default function FirstScorerOdds({ fixtureId, t }) {
  const [scorers, setScorers] = useState(null)

  useEffect(() => {
    if (!fixtureId) return
    setScorers(null)
    let cancelled = false
    fetchJson(`/api/v1/fixture_odds/${fixtureId}`)
      .then(({ data: d, ok }) => {
        if (cancelled || !ok || !d?.bets) return
        const list =
          d.bets["First Goal Scorer"] ||
          d.bets["Anytime Goal Scorer"] ||
          d.bets["Home First Goal Scorer"] || []
        if (list.length > 0) {
          setScorers([...list].sort((a, b) => parseFloat(a.odd) - parseFloat(b.odd)).slice(0, 8))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fixtureId])

  if (!scorers?.length) return null

  return (
    <div className="match-section" style={{ marginTop: 20 }}>
      <div className="match-section__title" style={{ marginBottom: 12 }}>⚽ {t("match.firstGoalScorer")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scorers.map((s, i) => (
          <div key={s.value} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px",
            background: i === 0 ? "rgba(238,30,70,.07)" : "var(--surface2)",
            borderRadius: 8,
            border: i === 0 ? "1px solid rgba(238,30,70,.18)" : "1px solid transparent",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", width: 18, textAlign: "center" }}>{i + 1}</span>
              <span style={{ fontWeight: i === 0 ? 700 : 500, fontSize: "0.85rem", color: "var(--text)" }}>{s.value}</span>
            </div>
            <span style={{
              background: i === 0 ? "rgba(238,30,70,.15)" : "var(--surface)",
              color: i === 0 ? "var(--accent)" : "var(--muted)",
              borderRadius: 6, padding: "3px 10px", fontSize: "0.8rem", fontWeight: 700,
            }}>{s.odd}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
