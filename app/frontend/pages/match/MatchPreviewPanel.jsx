import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import SafeImg from "../../components/SafeImg"
import { fetchJson } from "../../utils/fetchJson"
import FirstScorerOdds from "./FirstScorerOdds"

export function ComparisonBar({ label, home, away }) {
  const h = parseFloat(home) || 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: 4 }}>
        <span style={{ color: "var(--accent)", fontWeight: 700 }}>{home}</span>
        <span style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: "0.62rem" }}>{label}</span>
        <span style={{ color: "var(--away-blue)", fontWeight: 700 }}>{away}</span>
      </div>
      <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", background: "var(--border)" }}>
        <div style={{ width: `${h}%`, background: "var(--accent)", transition: "width .5s" }} />
        <div style={{ flex: 1, background: "var(--away-blue)" }} />
      </div>
    </div>
  )
}

export function InjuriesSection({ fixtureId, homeName, awayName }) {
  const { t } = useTranslation()
  const [injuries, setInjuries] = useState(null)

  useEffect(() => {
    const apiId = String(fixtureId).replace(/^ext-/, "")
    let cancelled = false
    fetchJson(`/api/v1/fixture_injuries/${apiId}`)
      .then(({ data: d, ok }) => { if (!cancelled) setInjuries(ok && Array.isArray(d) && d.length ? d : []) })
      .catch(() => { if (!cancelled) setInjuries([]) })
    return () => { cancelled = true }
  }, [fixtureId])

  if (!injuries?.length) return null

  const byTeam = injuries.reduce((acc, inj) => {
    const name = inj.team?.name || "?"
    if (!acc[name]) acc[name] = []
    acc[name].push(inj)
    return acc
  }, {})

  return (
    <section className="match-section" style={{ marginBottom: 20 }}>
      <h3 className="match-section__title">🚑 {t("match.injuries")}</h3>
      {Object.entries(byTeam).map(([teamName, list]) => (
        <div key={teamName} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".08em" }}>{teamName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {list.map((inj, i) => (
              <div key={inj.player?.name ? `${inj.player.name}-${i}` : i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--surface2)", borderRadius: 8 }}>
                {inj.player?.photo && (
                  <SafeImg src={inj.player.photo} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {inj.player?.name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{inj.reason}</div>
                </div>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700,
                  padding: "3px 8px", borderRadius: 10,
                  background: inj.type === "Missing Fixture" ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)",
                  color: inj.type === "Missing Fixture" ? "var(--danger)" : "var(--amber)",
                  whiteSpace: "nowrap",
                }}>
                  {inj.type === "Missing Fixture" ? t("match.injuryOut") : t("match.injuryDoubt")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export default function MatchPreviewPanel({ fixtureId, homeName, awayName, t }) {
  const [pred, setPred]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJson(`/api/v1/fixture_predictions/${fixtureId}`)
      .then(({ data: d, ok }) => setPred(ok && d?.percent ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [fixtureId])

  if (loading) return (
    <div style={{ padding: "20px 0" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="loading-shimmer" style={{ height: 22, borderRadius: 6, marginBottom: 14 }} />
      ))}
    </div>
  )

  if (!pred) return (
    <div style={{ paddingBottom: 8 }}>
      <InjuriesSection fixtureId={fixtureId} homeName={homeName} awayName={awayName} />
      <div className="empty-state" style={{ paddingTop: 20 }}>
        <div className="empty-state__icon">🔮</div>
        <h3>{t("match.noPrediction")}</h3>
      </div>
    </div>
  )

  const { winner, percent, goals, advice, under_over, comparison } = pred
  const COMP_ROWS = [
    { key: "form",  label: t("match.predForm") },
    { key: "att",   label: t("match.predAttack") },
    { key: "def",   label: t("match.predDefense") },
    { key: "h2h",   label: t("match.h2h") },
    { key: "goals", label: t("match.predGoals") },
    { key: "total", label: t("match.predTotal") },
  ]

  return (
    <div style={{ paddingBottom: 8 }}>
      <InjuriesSection fixtureId={fixtureId} homeName={homeName} awayName={awayName} />
      {/* Win probability */}
      <div className="match-section" style={{ marginBottom: 20 }}>
        <div className="match-section__title">{t("match.winProbability")}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, marginTop: 10 }}>
          {[
            { label: homeName, pct: percent?.home, color: "var(--accent)" },
            { label: t("match.draw"),  pct: percent?.draw, color: "var(--amber)" },
            { label: awayName, pct: percent?.away, color: "var(--away-blue)" },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color }}>{pct ?? "—"}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: percent?.home, background: "var(--accent)" }} />
          <div style={{ width: percent?.draw, background: "var(--amber)" }} />
          <div style={{ flex: 1, background: "var(--away-blue)" }} />
        </div>
      </div>

      {/* Comparison bars */}
      {comparison && Object.values(comparison).some(Boolean) && (
        <div className="match-section" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 700, marginBottom: 14 }}>
            <span style={{ color: "var(--accent)" }}>{homeName}</span>
            <span style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", fontSize: "0.6rem" }}>{t("match.comparison")}</span>
            <span style={{ color: "var(--away-blue)" }}>{awayName}</span>
          </div>
          {COMP_ROWS.map(({ key, label }) => {
            const val = comparison[key]
            if (!val?.home) return null
            return <ComparisonBar key={key} label={label} home={val.home} away={val.away} />
          })}
        </div>
      )}

      {/* Goals + Under/Over chips */}
      {(goals?.home || under_over) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {goals?.home && (
            <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{t("match.expectedGoals")}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>
                <span style={{ color: "var(--accent)" }}>{goals.home}</span>
                <span style={{ color: "var(--muted)", margin: "0 4px" }}>–</span>
                <span style={{ color: "var(--away-blue)" }}>{goals.away}</span>
              </div>
            </div>
          )}
          {under_over && (
            <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{t("match.underOver")}</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--amber)" }}>{under_over}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: "0.6rem", color: "var(--muted)", textAlign: "center", paddingTop: 4 }}>
        {t("match.predPoweredBy")}
      </div>
    </div>
  )
}


