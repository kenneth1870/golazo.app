import { useTranslation } from "react-i18next"
import { translateTeam } from "../../i18n/teamNames"

function EventIcon({ type, detail }) {
  const { t } = useTranslation()
  if (type === "Goal") {
    if (detail === "Own Goal")   return <span title={t("event.ownGoal")}>⚽<span style={{ fontSize: "0.55rem", verticalAlign: "top", color: "var(--danger)", fontWeight: 800 }}>OG</span></span>
    if (detail === "Penalty")    return <span title={t("event.penalty")}>⚽<span style={{ fontSize: "0.55rem", verticalAlign: "top", color: "var(--amber)", fontWeight: 800 }}>P</span></span>
    if (detail === "Missed Penalty") return <span title={t("event.missedPenalty")} style={{ fontSize: "1.1rem" }}>❌</span>
    return <span style={{ fontSize: "1.15rem" }}>⚽</span>
  }
  if (type === "Card") {
    if (detail === "Yellow Card") return (
      <span style={{ display: "inline-block", width: 14, height: 18, background: "#f59e0b", borderRadius: 2, boxShadow: "0 2px 6px rgba(245,158,11,.5)", flexShrink: 0 }} title={t("event.yellowCard")} />
    )
    if (detail === "Red Card") return (
      <span style={{ display: "inline-block", width: 14, height: 18, background: "#ef4444", borderRadius: 2, boxShadow: "0 2px 6px rgba(239,68,68,.5)", flexShrink: 0 }} title={t("event.redCard")} />
    )
    if (detail === "Second Yellow Card") return (
      <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }} title={t("event.secondYellow")}>
        <span style={{ display: "inline-block", width: 10, height: 15, background: "#f59e0b", borderRadius: 2 }} />
        <span style={{ display: "inline-block", width: 10, height: 15, background: "#ef4444", borderRadius: 2 }} />
      </span>
    )
  }
  if (type === "subst")   return <span style={{ fontSize: "1rem" }} title={t("event.substitution")}>🔄</span>
  if (type === "Var") {
    if (detail?.includes("cancelled") || detail?.includes("disallowed")) return <span title={detail}>📹❌</span>
    if (detail?.includes("Penalty confirmed"))  return <span title={detail}>📹✅</span>
    if (detail?.includes("Card upgrade"))       return <span title={detail}>📹🟥</span>
    return <span title={detail || t("event.var")}>📹</span>
  }
  if (type === "injury")  return <span style={{ fontSize: "1rem" }} title={t("event.injury")}>🩹</span>
  return <span>•</span>
}

function PeriodDivider({ label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, margin: "8px 0",
      color: "var(--muted)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: 1,
      textTransform: "uppercase",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ padding: "2px 10px", background: "var(--surface2)", borderRadius: 12, whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  )
}

export default function MatchEventsPanel({ events, homeTeam, awayTeam, t, i18n }) {
  if (!events?.length) return null

  const RELEVANT_TYPES = ["Goal", "Card", "subst", "Var", "injury"]
  const relevant = events.filter(e => RELEVANT_TYPES.includes(e.type))
  if (!relevant.length) return null

  const regularEvents  = relevant.filter(e => e.period !== "Penalty")
  const penaltyEvents  = relevant.filter(e => e.period === "Penalty")

  const items = []
  let htInserted  = false
  let etInserted  = false
  let et2Inserted = false
  let htHomeGoals = 0, htAwayGoals = 0, htHomeCards = 0, htAwayCards = 0

  regularEvents.forEach(e => {
    const min = e.minute ?? 0
    if (!htInserted && min > 45) {
      items.push({ _divider: t("match.htDivider") })
      items.push({ _htSummary: { homeGoals: htHomeGoals, awayGoals: htAwayGoals, homeCards: htHomeCards, awayCards: htAwayCards } })
      htInserted = true
    }
    if (!htInserted) {
      if (e.type === "Goal" && e.detail !== "Missed Penalty") {
        if (e.team?.name === homeTeam) htHomeGoals++; else htAwayGoals++
      }
      if (e.type === "Card") {
        if (e.team?.name === homeTeam) htHomeCards++; else htAwayCards++
      }
    }
    if (!etInserted && min > 90) {
      items.push({ _divider: t("match.etDivider") })
      etInserted = true
    }
    if (!et2Inserted && min > 105) {
      items.push({ _divider: t("match.et2Divider") })
      et2Inserted = true
    }
    items.push(e)
  })

  let homeGoals = 0, awayGoals = 0

  return (
    <section className="match-section">
      <h3 className="match-section__title">{t("match.events")}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.map((e, i) => {
          if (e._divider) return <PeriodDivider key={`d${i}`} label={e._divider} />
          if (e._htSummary) {
            const s = e._htSummary
            const hasActivity = s.homeGoals + s.awayGoals + s.homeCards + s.awayCards > 0
            if (!hasActivity) return null
            return (
              <div key={`ht-sum${i}`} style={{
                background: "var(--surface2)", borderRadius: 8, padding: "10px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: "0.76rem", color: "var(--muted)", margin: "4px 0 8px",
              }}>
                <div style={{ textAlign: "left" }}>
                  {s.homeGoals > 0 && <div>⚽ ×{s.homeGoals}</div>}
                  {s.homeCards > 0 && <div>🟨 ×{s.homeCards}</div>}
                </div>
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.68rem", letterSpacing: ".06em", color: "var(--muted)", textTransform: "uppercase" }}>
                  1st half
                </div>
                <div style={{ textAlign: "right" }}>
                  {s.awayGoals > 0 && <div>⚽ ×{s.awayGoals}</div>}
                  {s.awayCards > 0 && <div>🟨 ×{s.awayCards}</div>}
                </div>
              </div>
            )
          }

          const teamHome  = e.team?.name === homeTeam
          const isGoal    = e.type === "Goal" && e.detail !== "Missed Penalty"
          const isMissed  = e.type === "Goal" && e.detail === "Missed Penalty"
          const isHome    = (isGoal && e.detail === "Own Goal") ? !teamHome : teamHome
          const isSub     = e.type === "subst"
          const isVar     = e.type === "Var"
          const minuteStr = `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`
          const varCancelled = isVar && (e.detail?.toLowerCase().includes("cancel") || e.detail?.toLowerCase().includes("disallow"))

          return (
            <div key={`${e.minute}-${e.type}-${e.player ?? ""}-${i}`}
              className={`match-event${isGoal ? " match-event--goal" : ""}${isSub ? " match-event--sub" : ""}${isVar ? " match-event--var" : ""}${isMissed ? " match-event--missed" : ""}`}
              style={{ flexDirection: isHome ? "row" : "row-reverse", opacity: varCancelled ? 0.65 : 1 }}
            >
              <span className="match-event__minute">{minuteStr}</span>
              <span className="match-event__icon">
                <EventIcon type={e.type} detail={e.detail} />
              </span>
              <div className="match-event__info" style={{ textAlign: isHome ? "left" : "right" }}>
                <span className={`match-event__player${isGoal ? " match-event__player--goal" : ""}`}>
                  {e.player}
                </span>
                {isGoal && e.assist && (
                  <span className="match-event__assist"> {t("match.assist")}: {e.assist}</span>
                )}
                {isSub && e.assist && (
                  <span className="match-event__assist"> ↑ {e.assist}</span>
                )}
                {isVar && e.detail && (
                  <span className="match-event__assist" style={{ color: varCancelled ? "var(--danger)" : "var(--success)" }}>
                    {" "}{e.detail}
                    {e.comments ? ` — ${e.comments}` : ""}
                  </span>
                )}
                {isMissed && (
                  <span className="match-event__assist" style={{ color: "var(--danger)" }}> {t("match.missedPenalty")}</span>
                )}
              </div>
              {!isSub && !isVar && (
                <span className="match-event__team" style={{ textAlign: isHome ? "right" : "left", fontSize: "0.68rem", color: "var(--muted)" }}>
                  {translateTeam(e.team?.name, i18n.language)}
                </span>
              )}
            </div>
          )
        })}

        {penaltyEvents.length > 0 && (
          <>
            <PeriodDivider label={t("match.penaltyShootout")} />
            {penaltyEvents.map((e, i) => {
              const isHome   = e.team?.name === homeTeam
              const scored   = e.detail !== "Missed Penalty"
              if (scored && isHome)  homeGoals++
              if (scored && !isHome) awayGoals++

              return (
                <div key={`pk${i}`}
                  className="match-event"
                  style={{ flexDirection: isHome ? "row" : "row-reverse", opacity: scored ? 1 : 0.55 }}
                >
                  <span className="match-event__minute">{i + 1}</span>
                  <span className="match-event__icon">
                    {scored ? "✅" : "❌"}
                  </span>
                  <div className="match-event__info" style={{ textAlign: isHome ? "left" : "right" }}>
                    <span className="match-event__player" style={{ color: scored ? "var(--text)" : "var(--muted)" }}>
                      {e.player}
                    </span>
                    <span className="match-event__assist" style={{ color: scored ? "var(--success)" : "var(--danger)" }}>
                      {scored ? " scored" : " missed"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, color: "var(--text)", minWidth: 36, textAlign: isHome ? "right" : "left" }}>
                    {homeGoals}–{awayGoals}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}
