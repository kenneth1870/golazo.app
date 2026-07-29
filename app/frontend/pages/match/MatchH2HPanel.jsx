import { translateLeague } from "../../i18n/leagueNames"
import { translateTeam } from "../../i18n/teamNames"

export default function MatchH2HPanel({ h2h, homeTeamName, awayTeamName, t, lang }) {
  if (!h2h?.matches?.length) return (
    <div className="empty-state">
      <div className="empty-state__icon">📈</div>
      <h3>{t("match.noH2H")}</h3>
      <p>{t("match.h2hPrev")}</p>
    </div>
  )

  const computedSummary = (() => {
    let hw = 0, d = 0, aw = 0
    const homeLower = (homeTeamName || "").toLowerCase()
    const awayLower = (awayTeamName || "").toLowerCase()
    for (const m of h2h.matches) {
      const hs = Number(m.home?.score ?? NaN)
      const as_ = Number(m.away?.score ?? NaN)
      if (isNaN(hs) || isNaN(as_)) continue
      const mHomeLower = (m.home?.name || "").toLowerCase()
      const mAwayLower = (m.away?.name || "").toLowerCase()
      const homeIsHome = homeLower.split(" ").some(w => w.length > 2 && mHomeLower.includes(w))
      const homeIsAway = homeLower.split(" ").some(w => w.length > 2 && mAwayLower.includes(w))
      if (hs === as_) { d++; continue }
      if ((homeIsHome && hs > as_) || (homeIsAway && as_ > hs)) hw++
      else aw++
    }
    return [hw, d, aw]
  })()
  const [hw, d, aw] = h2h.summary || computedSummary
  const total = hw + d + aw || 1

  return (
    <>
      <section className="match-section">
        <h3 className="match-section__title">{t("match.h2hSummary")}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--accent)" }}>{hw}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{homeTeamName}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--muted)" }}>{d}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{t("match.draw")}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--away-blue)" }}>{aw}</div>
            <div style={{ fontSize: ".68rem", color: "var(--muted)", marginTop: 2 }}>{awayTeamName}</div>
          </div>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
          <div style={{ width: `${(hw/total)*100}%`, background: "var(--accent)" }} />
          <div style={{ width: `${(d/total)*100}%`, background: "var(--border)" }} />
          <div style={{ width: `${(aw/total)*100}%`, background: "var(--away-blue)" }} />
        </div>
      </section>

      <section className="match-section">
        <h3 className="match-section__title">{t("match.recentMeetings")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {h2h.matches.map((m, i) => {
            const hs   = m.home?.score ?? "–"
            const as   = m.away?.score ?? "–"
            const date = m.kickoff_at
              ? new Date(m.kickoff_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
              : ""
            const homeWon = Number(hs) > Number(as)
            const awayWon = Number(as) > Number(hs)
            return (
              <div key={m.kickoff_at ?? i} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "9px 12px",
                background: i % 2 === 0 ? "transparent" : "var(--surface2)",
                borderRadius: 6, fontSize: "0.8rem",
              }}>
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ fontSize: ".65rem", color: "var(--muted)" }}>{date}</div>
                  {m.competition?.name && <div style={{ fontSize: ".58rem", color: "#555", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80 }}>{translateLeague(m.competition.name, lang)}</div>}
                </div>
                <span style={{ flex: 1, textAlign: "right", fontWeight: homeWon ? 800 : 500, color: homeWon ? "var(--text)" : "var(--muted)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{translateTeam(m.home?.name, lang)}</span>
                <span style={{ fontWeight: 900, color: "var(--text)", padding: "3px 12px", background: "var(--surface2)", borderRadius: 4, fontSize: ".9rem", flexShrink: 0, minWidth: 64, textAlign: "center" }}>{hs} – {as}</span>
                <span style={{ flex: 1, fontWeight: awayWon ? 800 : 500, color: awayWon ? "var(--text)" : "var(--muted)", fontSize: ".8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{translateTeam(m.away?.name, lang)}</span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
