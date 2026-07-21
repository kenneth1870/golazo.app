import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  const homeStat = stats.find(s => s.team_id === homeTeam?.id) || {}
  const awayStat = stats.find(s => s.team_id === awayTeam?.id) || {}

  const STAT_LABELS = [
    { key: "possession",      label: t("live.statPossession"),     isPercent: true  },
    { key: "shots",           label: t("live.statShots"),          isPercent: false },
    { key: "shots_on_target", label: t("live.statShotsOnTarget"),  isPercent: false },
    { key: "corners",         label: t("live.statCorners"),        isPercent: false },
    { key: "fouls",           label: t("live.statFouls"),          isPercent: false },
    { key: "yellow_cards",    label: t("live.statYellowCards"),    isPercent: false },
    { key: "red_cards",       label: t("live.statRedCards"),       isPercent: false },
    { key: "offsides",        label: t("live.statOffsides"),       isPercent: false },
  ]

  return (
    <div className="widget-next-match mt-4">
      <div className="widget-title">
        <h3>{t("live.matchStats")}</h3>
      </div>
      <div className="widget-body">
        <div className="d-flex justify-content-between mb-3" style={{ padding: "0 8px" }}>
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{homeTeam?.code}</span>
          <span style={{ color: "gray", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: 1 }}>vs</span>
          <span style={{ color: "var(--muted)", fontWeight: 700 }}>{awayTeam?.code}</span>
        </div>
        {STAT_LABELS.map(({ key, label, isPercent }) => (
          <StatRow
            key={key}
            label={label}
            homeVal={homeStat[key]}
            awayVal={awayStat[key]}
            isPercent={isPercent}
          />
        ))}
      </div>
    </div>
  )
}
