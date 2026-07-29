import { useTranslation } from "react-i18next"
import SafeImg from "../../components/SafeImg"
import { translateTeam } from "../../i18n/teamNames"

const STAT_ORDER = [
  "Ball Possession","Total Shots","Shots on Goal","Shots off Goal",
  "Blocked Shots","Corner Kicks","Offsides","Fouls",
  "Yellow Cards","Red Cards","Goalkeeper Saves","Passes %",
]

const STAT_I18N = {
  "Ball Possession":   "match.statBallPossession",
  "Total Shots":       "match.statTotalShots",
  "Shots on Goal":     "match.statShotsOnGoal",
  "Shots off Goal":    "match.statShotsOffGoal",
  "Blocked Shots":     "match.statBlockedShots",
  "Corner Kicks":      "match.statCornerKicks",
  "Offsides":          "match.statOffsides",
  "Fouls":             "match.statFouls",
  "Yellow Cards":      "match.statYellowCards",
  "Red Cards":         "match.statRedCards",
  "Goalkeeper Saves":  "match.statGoalkeeperSaves",
  "Passes %":          "match.statPassesAccuracy",
}

function parseVal(v) {
  if (v === null || v === undefined) return 0
  return parseInt(String(v).replace("%", "")) || 0
}

function StatBar({ label, homeVal, awayVal, isPct }) {
  const h = parseVal(homeVal)
  const total = h + parseVal(awayVal) || 1
  const homePct = isPct ? h : Math.round((h / total) * 100)
  const fmt = (v) => `${parseVal(v)}${isPct ? "%" : ""}`

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: "0.8rem" }}>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(homeVal)}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.72rem" }}>{label}</span>
        <span style={{ fontWeight: 700, color: "var(--text)" }}>{fmt(awayVal)}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
        <div style={{ width: `${homePct}%`, background: "var(--accent)", transition: "width .4s" }} />
        <div style={{ flex: 1, background: "var(--away-blue)" }} />
      </div>
    </div>
  )
}

export default function MatchStatsPanel({ stats, home, away, t, statusShort }) {
  const { i18n } = useTranslation()
  const isFT = ["FT", "AET", "PEN"].includes(statusShort)
  const isNS = statusShort === "NS"

  if (!stats?.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📊</div>
      <h3>{t("match.statsUnavailable")}</h3>
      <p style={{ maxWidth: 280, textAlign: "center" }}>
        {isFT ? t("match.statsNotProvided") : isNS ? t("match.statsAppear") : t("match.statsAppear")}
      </p>
    </div>
  )

  const [homeS, awayS] = stats
  const homeStat = (type) => homeS?.stats?.find(s => s.type === type)?.value
  const awayStat = (type) => awayS?.stats?.find(s => s.type === type)?.value
  const pairs = STAT_ORDER
    .map(type => ({ type, h: homeStat(type), a: awayStat(type) }))
    .filter(({ h, a }) => h !== null && h !== undefined && a !== null && a !== undefined)

  if (!pairs.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">📊</div>
      <h3>{t("match.statsUnavailable")}</h3>
      <p style={{ maxWidth: 280, textAlign: "center" }}>
        {isFT ? t("match.statsNotProvided") : t("match.statsAppear")}
      </p>
    </div>
  )

  return (
    <section className="match-section">
      <div className="match-stats-header">
        <div className="match-stats-header__team match-stats-header__team--home">
          <SafeImg src={home?.logo} className="logo-sm" />
          <span>{translateTeam(home?.name, i18n.language)}</span>
        </div>
        <h3 className="match-section__title match-stats-header__title">{t("match.statistics")}</h3>
        <div className="match-stats-header__team match-stats-header__team--away">
          <span>{translateTeam(away?.name, i18n.language)}</span>
          <SafeImg src={away?.logo} className="logo-sm" />
        </div>
      </div>
      {pairs.map(({ type, h, a }) => (
        <StatBar key={type} label={t(STAT_I18N[type] || type)} homeVal={h} awayVal={a} isPct={String(h).includes("%")} />
      ))}
    </section>
  )
}
