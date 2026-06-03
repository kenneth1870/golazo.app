const STAT_LABELS = {
  possession: "Possession",
  shots: "Shots",
  shots_on_target: "Shots on Target",
  corners: "Corners",
  fouls: "Fouls",
  yellow_cards: "Yellow Cards",
  red_cards: "Red Cards",
  offsides: "Offsides",
}

function StatBar({ label, homeVal, awayVal, isPercent }) {
  const total = (homeVal || 0) + (awayVal || 0)
  const homePct = total === 0 ? 50 : Math.round(((homeVal || 0) / total) * 100)

  return (
    <div className="stat-row">
      <span className="stat-val home">{isPercent ? `${homeVal}%` : homeVal ?? 0}</span>
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <div className="stat-bar">
          <div className="stat-bar-home" style={{ width: `${homePct}%` }} />
          <div className="stat-bar-away" style={{ width: `${100 - homePct}%` }} />
        </div>
      </div>
      <span className="stat-val away">{isPercent ? `${awayVal}%` : awayVal ?? 0}</span>
    </div>
  )
}

export default function LiveStats({ stats, homeTeam, awayTeam }) {
  const homeStat = stats.find(s => s.team_id === homeTeam?.id) || {}
  const awayStat = stats.find(s => s.team_id === awayTeam?.id) || {}

  return (
    <div className="live-stats">
      <div className="stats-header">
        <span>{homeTeam?.code}</span>
        <h3>Match Stats</h3>
        <span>{awayTeam?.code}</span>
      </div>
      <div className="stats-body">
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <StatBar
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
