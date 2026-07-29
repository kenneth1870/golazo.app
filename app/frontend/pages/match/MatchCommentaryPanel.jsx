export default function MatchCommentaryPanel({ events, homeTeamRaw, homeName, awayName }) {
  const feedItems = [...(events ?? [])]
    .filter(e => e.comments || e.type === "Goal" || e.type === "Card" || e.type === "Var")
    .reverse()

  if (!feedItems.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📝</div>
      <h3>No commentary yet</h3>
    </div>
  )

  const iconFor = (type, detail) => {
    if (type === "Goal")  return detail === "Own Goal" ? "🔴 OG" : "⚽"
    if (type === "Card")  return detail?.includes("Yellow") ? "🟨" : "🟥"
    if (type === "Var")   return "🖥️ VAR"
    if (type === "subst") return "🔄"
    return "📢"
  }

  return (
    <section className="match-section">
      <h3 className="match-section__title" style={{ marginBottom: 12 }}>📝 Match Feed</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {feedItems.map((e, i) => {
          const isHome = e.team?.name === homeTeamRaw
          const min    = `${e.minute ?? ""}${e.extra ? `+${e.extra}` : ""}'`
          return (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "10px 14px",
              background: "var(--surface2)", borderRadius: 8,
              borderLeft: `3px solid ${e.type === "Goal" ? "var(--accent)" : e.type === "Card" ? "var(--amber)" : "var(--border)"}`,
            }}>
              <div style={{ flexShrink: 0, textAlign: "center", minWidth: 36 }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--muted)" }}>{min}</div>
                <div style={{ fontSize: "0.9rem", marginTop: 2 }}>{iconFor(e.type, e.detail)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
                  {e.player || e.type} · <span style={{ color: "var(--muted)", fontWeight: 400 }}>{isHome ? homeName : awayName}</span>
                </div>
                {e.comments && (
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{e.comments}</div>
                )}
                {e.detail && e.detail !== e.type && (
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>{e.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
