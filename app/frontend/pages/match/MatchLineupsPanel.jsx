import { useTranslation } from "react-i18next"
import SafeImg from "../../components/SafeImg"
import { translateTeam } from "../../i18n/teamNames"
import FirstScorerOdds from "./FirstScorerOdds"
import { POS_STYLE, posStyle, posLabel } from "./matchPosStyles"

function PlayerDot({ number, pos, name }) {
  const { t }    = useTranslation()
  const ps       = posStyle(pos)
  const lastName = name?.split(" ").slice(-1)[0] || ""
  return (
    <div className="player-dot">
      <div className="player-dot__circle" style={{ background: ps.bg, boxShadow: `0 3px 10px ${ps.shadow}` }}>
        {number}
      </div>
      <div className="player-dot__pos" style={{ color: ps.bg }}>{posLabel(pos, t)}</div>
      <div className="player-dot__name">{lastName}</div>
    </div>
  )
}

function LineupTeam({ team }) {
  const { t, i18n } = useTranslation()
  if (!team?.start_xi?.length) return null
  const byRow = team.start_xi.reduce((acc, p) => {
    const row = p.grid?.split(":")[0] || "1"
    if (!acc[row]) acc[row] = []
    acc[row].push(p)
    return acc
  }, {})
  const rows = Object.keys(byRow).sort((a, b) => b - a)

  return (
    <div className="lineup-team">
      <div className="lineup-team__header">
        <SafeImg src={team.team?.logo} className="logo-sm" />
        <div>
          <div className="lineup-team__name">{translateTeam(team.team?.name, i18n.language)}</div>
          {team.formation && (
            <div className="lineup-team__formation">{team.formation}</div>
          )}
        </div>
      </div>
      <div className="lineup-pitch">
        <div className="lineup-pitch__lines" />
        {rows.map(row => (
          <div key={row} className="lineup-row">
            {byRow[row].map(p => (
              <PlayerDot key={p.number} number={p.number} pos={p.pos} name={p.name} />
            ))}
          </div>
        ))}
      </div>
      {team.subs?.length > 0 && (
        <div className="lineup-subs">
          <div className="lineup-subs__title">{t("match.substitutes")}</div>
          {team.subs.map((p, i) => {
            const ps = posStyle(p.pos)
            return (
              <div key={p.number ?? p.name ?? i} className="lineup-sub-row">
                <span className="lineup-sub-row__num" style={{ background: ps.bg }}>{p.number}</span>
                <span className="lineup-sub-row__name">{p.name}</span>
                <span className="lineup-sub-row__pos" style={{ color: ps.bg }}>{posLabel(p.pos, t)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PosLegend() {
  const { t } = useTranslation()
  return (
    <div className="pos-legend">
      {Object.entries(POS_STYLE).map(([k, v]) => (
        <span key={k} className="pos-legend__item">
          <span className="pos-legend__dot" style={{ background: v.bg }} />
          {posLabel(k, t)}
        </span>
      ))}
    </div>
  )
}

export default function MatchLineupsPanel({ lineups, fixtureId, t, statusShort }) {
  const isPreKickoff = ["NS", "TBD"].includes(statusShort)

  if (lineups === undefined) {
    return <div className="loading-shimmer" style={{ height: 200, borderRadius: 12 }} />
  }

  const noData = !lineups?.length

  if (noData || !lineups.some(l => l?.start_xi?.length > 0)) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">👕</div>
      <h3>{isPreKickoff ? t("match.lineupsUnavailable") : t("match.lineupsNotProvided")}</h3>
      {isPreKickoff && (
        <p style={{ maxWidth: 280, textAlign: "center" }}>
          {t("match.lineupsRelease")}
        </p>
      )}
    </div>
  )
  const [home, away] = lineups
  return (
    <div>
      <PosLegend />
      <div className="lineups-grid">
        <LineupTeam team={home} />
        <LineupTeam team={away} />
      </div>
      {isPreKickoff && <FirstScorerOdds fixtureId={fixtureId} t={t} />}
    </div>
  )
}
