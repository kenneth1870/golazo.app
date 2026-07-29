import { useTranslation } from "react-i18next"

export function ScoreTimeline({ events, homeTeamRaw, homeName, awayName, t }) {
  const goals = (events ?? []).filter(e => e.type === "Goal" && e.detail !== "Missed Penalty")
  if (!goals.length) return null

  let h = 0, a = 0
  const moments = goals.map(e => {
    const isOG      = e.detail === "Own Goal"
    const teamHome  = e.team?.name === homeTeamRaw
    if (teamHome) h++; else a++
    return {
      min:    `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`,
      player: e.player,
      isHome: isOG ? !teamHome : teamHome,
      isOG,
      isP:    e.detail === "Penalty",
      score:  `${h}–${a}`,
    }
  })

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        ⚽ {t("match.goalTimeline")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 56px 1fr", gap: 8, marginBottom: 4 }}>
        <div style={{ textAlign: "right", fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{homeName}</div>
        <div />
        <div style={{ textAlign: "left",  fontSize: "0.65rem", color: "var(--away-blue)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{awayName}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {moments.map((m, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 56px 1fr", alignItems: "center", gap: 8, padding: "3px 0" }}>
            <div style={{ textAlign: "right" }}>
              {m.isHome && (
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                    {m.player}
                    {m.isOG && <span style={{ color: "var(--danger)", fontSize: "0.65rem" }}> OG</span>}
                    {m.isP  && <span style={{ color: "var(--amber)", fontSize: "0.65rem" }}> P</span>}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--accent)", fontWeight: 700 }}>{m.min}</span>
                </div>
              )}
            </div>
            <div style={{
              textAlign: "center", fontWeight: 900, fontSize: "0.85rem", color: "var(--text)",
              background: "var(--surface2)", borderRadius: 6, padding: "4px 6px",
              border: "1px solid var(--border)", flexShrink: 0,
            }}>
              {m.score}
            </div>
            <div>
              {!m.isHome && (
                <div style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.3 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                    {m.player}
                    {m.isOG && <span style={{ color: "var(--danger)", fontSize: "0.65rem" }}> OG</span>}
                    {m.isP  && <span style={{ color: "var(--amber)", fontSize: "0.65rem" }}> P</span>}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--away-blue)", fontWeight: 700 }}>{m.min}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MiniStatsBar({ stats, homeName, awayName }) {
  const { t } = useTranslation()
  if (!stats?.length) return null
  const [homeS, awayS] = stats
  const getStat = (s, type) => s?.stats?.find(r => r.type === type)?.value
  const possession = getStat(homeS, "Ball Possession")
  const totalShots = [getStat(homeS, "Total Shots"), getStat(awayS, "Total Shots")]
  const onTarget   = [getStat(homeS, "Shots on Goal"), getStat(awayS, "Shots on Goal")]

  if (!possession && !totalShots[0]) return null

  const homePoss  = parseInt(possession) || 50
  const awayPoss  = 100 - homePoss

  return (
    <div style={{
      background: "var(--surface2)", borderRadius: 10,
      padding: "12px 16px", marginBottom: 16,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)", marginBottom: 2 }}>
        <span style={{ color: "var(--accent)" }}>{homeName}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.62rem" }}>{t("match.statStatsSnapshot")}</span>
        <span style={{ color: "var(--away-blue)" }}>{awayName}</span>
      </div>
      {possession && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{homePoss}%</span>
            <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{t("match.statBallPossession")}</span>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>{awayPoss}%</span>
          </div>
          <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${homePoss}%`, background: "var(--accent)", transition: "width .4s" }} />
            <div style={{ flex: 1, background: "var(--away-blue)" }} />
          </div>
        </div>
      )}
      {totalShots[0] !== undefined && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{totalShots[0] ?? 0}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.65rem" }}>
            {t("match.statShots")}{onTarget[0] !== undefined ? ` (${onTarget[0] ?? 0} / ${onTarget[1] ?? 0} ${t("match.statShotsOnTarget").toLowerCase()})` : ""}
          </span>
          <span style={{ fontWeight: 700, color: "var(--text)" }}>{totalShots[1] ?? 0}</span>
        </div>
      )}
    </div>
  )
}
