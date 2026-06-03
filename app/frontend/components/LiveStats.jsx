const STAT_LABELS = {
  possession:       "Possession",
  shots:            "Shots",
  shots_on_target:  "Shots on Target",
  corners:          "Corners",
  fouls:            "Fouls",
  yellow_cards:     "Yellow Cards",
  red_cards:        "Red Cards",
  offsides:         "Offsides",
}

function StatRow({ label, homeVal, awayVal, isPercent }) {
  const h = homeVal ?? 0
  const a = awayVal ?? 0
  const total = h + a
  const homePct = total === 0 ? 50 : Math.round((h / total) * 100)

  return (
    <div className="stat-row">
      <span className="stat-val text-right">{isPercent ? `${h}%` : h}</span>
      <div className="stat-label-wrap">
        <div className="stat-label-text">{label}</div>
        <div className="stat-bar-track">
          <div className="stat-bar-home" style={{ width: `${homePct}%` }} />
          <div className="stat-bar-away" style={{ width: `${100 - homePct}%` }} />
        </div>
      </div>
      <span className="stat-val">{isPercent ? `${a}%` : a}</span>
    </div>
  )
}

export default function LiveStats({ stats, homeTeam, awayTeam }) {
  const homeStat = stats.find(s => s.team_id === homeTeam?.id) || {}
  const awayStat = stats.find(s => s.team_id === awayTeam?.id) || {}

  return (
    <div className="widget-next-match mt-4">
      <div className="widget-title">
        <h3>Match Stats</h3>
      </div>
      <div className="widget-body">
        <div className="d-flex justify-content-between mb-3" style={{ padding: "0 8px" }}>
          <span style={{ color: "#ee1e46", fontWeight: 700 }}>{homeTeam?.code}</span>
          <span style={{ color: "gray", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: 1 }}>vs</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 700 }}>{awayTeam?.code}</span>
        </div>
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <StatRow
            key={key}
            label={label}
            homeVal={homeStat[key]}
            awayVal={awayStat[key]}
            isPercent={key === "possession"}
          />
        ))}
      </div>
    </div>
  )
}
