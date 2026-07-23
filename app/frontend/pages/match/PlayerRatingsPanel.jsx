import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import SafeImg from "../../components/SafeImg"
import { translateTeam } from "../../i18n/teamNames"
import { fetchJson } from "../../utils/fetchJson"
import EmptyState from "../../components/EmptyState"

export const RATING_COLOR = r => {
  const n = parseFloat(r)
  if (isNaN(n)) return "var(--muted)"
  if (n >= 8)   return "var(--green)"
  if (n >= 6.5) return "var(--amber)"
  return "var(--danger)"
}

export default function PlayerRatingsPanel({ fixtureId }) {
  const { t, i18n } = useTranslation()
  const [teams, setTeams]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiId = String(fixtureId).replace(/^ext-/, "")
    fetchJson(`/api/v1/fixture_ratings/${apiId}`)
      .then(({ data: d, ok }) => setTeams(ok && Array.isArray(d) && d.length ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fixtureId])

  // Find MOTM: highest-rated player across both teams
  const motmKey = teams ? (() => {
    let best = null, bestVal = -1
    teams.forEach(team => {
      ;(team.players || []).forEach(p => {
        const v = parseFloat(p.rating)
        if (!isNaN(v) && v > bestVal) { bestVal = v; best = `${team.team?.id}-${p.name}` }
      })
    })
    return best
  })() : null

  if (loading) return (
    <div style={{ paddingTop: 16 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="loading-shimmer" style={{ height: 56, borderRadius: 8, marginBottom: 6 }} />
      ))}
    </div>
  )

  if (!teams) return (
    <EmptyState icon="📊" title={t("match.ratingsEmpty")} description={t("match.ratingsAppear")} />
  )

  return (
    <div style={{ paddingBottom: 8 }}>
      {teams.map((team, ti) => (
        <section key={ti} className="match-section" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <SafeImg src={team.team?.logo} style={{ width: 22, height: 22, objectFit: "contain" }} />
            <h3 className="match-section__title" style={{ margin: 0 }}>{translateTeam(team.team?.name, i18n.language)}</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(team.players || [])
              .sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0))
              .map((p, pi) => {
                const rating  = parseFloat(p.rating)
                const color   = RATING_COLOR(p.rating)
                const isMotm  = motmKey === `${team.team?.id}-${p.name}`
                return (
                  <div key={pi} style={{
                    display: "grid", gridTemplateColumns: "22px 1fr 80px 44px",
                    gap: 8, alignItems: "center",
                    padding: "8px 12px",
                    background: isMotm ? "rgba(245,158,11,.07)" : pi % 2 === 0 ? "transparent" : "var(--surface2)",
                    borderRadius: 6,
                    border: isMotm ? "1px solid rgba(245,158,11,.25)" : "1px solid transparent",
                  }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", textAlign: "center", fontWeight: 700 }}>
                      {p.number ?? ""}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {isMotm && <span style={{ marginRight: 4 }} title="Man of the Match">👑</span>}
                        {p.captain ? "©" : ""}{p.name}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>
                        {p.position ?? ""}{p.minutes ? ` · ${p.minutes}'` : ""}
                        {(p.goals?.total > 0) ? ` ⚽×${p.goals.total}` : ""}
                        {(p.goals?.assists > 0) ? ` 🎯×${p.goals.assists}` : ""}
                        {(p.cards?.yellow > 0) ? " 🟨" : ""}
                        {(p.cards?.red > 0) ? " 🟥" : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {p.passes?.total != null && (
                        <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                          {p.passes.total} pases {p.passes.accuracy != null ? `· ${p.passes.accuracy}%` : ""}
                        </div>
                      )}
                      {p.shots?.total != null && (
                        <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>
                          {p.shots.total} tiros{p.shots.on != null ? ` (${p.shots.on} a puerta)` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontWeight: 900, fontSize: "1rem", color,
                      textAlign: "right",
                      padding: "4px 8px",
                      background: `${color}18`,
                      borderRadius: 6,
                    }}>
                      {isNaN(rating) ? "–" : rating.toFixed(1)}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
