import { useParams, useNavigate, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMatches } from "../hooks/useMatches"
import MatchRow from "../components/MatchRow"
import { usePageMeta } from "../hooks/usePageMeta"
import { translateTeam } from "../i18n/teamNames"

// ─── Qualification scenario logic ─────────────────────
// WC 2026: top 2 from each group advance automatically.
// 8 best 3rd-place teams also advance, determined after all groups finish.
function getScenario(team, rank, standings, t) {
  const played    = team.played   ?? 0
  const pts       = team.points   ?? 0
  const remaining = Math.max(0, 3 - played)
  const maxPts    = pts + remaining * 3
  const isDone    = standings.every(s => (s.played ?? 0) >= 3)

  if (isDone) {
    if (rank === 0) return { status: "qualified",  label: t("groups.qualified"),    color: "#10b981", icon: "✅" }
    if (rank === 1) return { status: "qualified",  label: t("groups.qualified"),    color: "#10b981", icon: "✅" }
    if (rank === 2) return { status: "third",      label: t("groups.thirdPending"), color: "#f59e0b", icon: "🟡" }
    return                  { status: "eliminated", label: t("groups.eliminated"),   color: "#ef4444", icon: "❌" }
  }

  // Still playing
  const secondPts     = standings[1]?.points   ?? 0
  const thirdTeam     = standings[2]
  const thirdMaxPts   = (thirdTeam?.points ?? 0) + Math.max(0, 3 - (thirdTeam?.played ?? 0)) * 3

  // Can't catch 2nd place even with perfect remaining run?
  if (maxPts < secondPts) {
    return { status: "eliminated", label: t("groups.eliminated"), color: "#ef4444", icon: "❌" }
  }

  // Already top 2 and 3rd can't overtake?
  if (rank < 2 && pts > thirdMaxPts) {
    return { status: "qualified", label: t("groups.qualified"), color: "#10b981", icon: "✅" }
  }

  // Currently top 2, but not yet clinched
  if (rank < 2) {
    return { status: "advancing", label: t("groups.advancing"), color: "#10b981", icon: "🟢" }
  }

  // Rank 2+ — still possible
  const ptsNeeded = Math.max(1, secondPts - pts + (remaining > 0 ? 0 : 1))
  if (ptsNeeded <= 0) {
    return { status: "contention", label: t("groups.inContention"), color: "#f59e0b", icon: "🟡" }
  }
  return {
    status: "contention",
    label:  `${t("groups.needsPts", { pts: ptsNeeded })} ${t("groups.from")} ${t("groups.matches", { count: remaining })}`,
    color:  "#f59e0b",
    icon:   "🟠",
  }
}

function QualificationPanel({ standings, t, lang }) {
  if (!standings?.length) return null
  // Only show when at least one match has been played
  const anyPlayed = standings.some(s => (s.played ?? 0) > 0)
  if (!anyPlayed) return null

  return (
    <div style={{ marginTop: 16, padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
        {t("groups.qualTitle")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {standings.map((s, idx) => {
          const scenario = getScenario(s, idx, standings, t)
          const teamName = translateTeam(s.team?.name, lang)
          return (
            <div key={s.team?.id ?? idx} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {s.team?.flag_url && (
                <img src={s.team.flag_url} alt="" style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 2, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: "#fff", minWidth: 0 }}>
                {teamName}
              </span>
              <span style={{
                fontSize: "0.68rem", fontWeight: 700, color: scenario.color,
                background: `${scenario.color}18`,
                border: `1px solid ${scenario.color}40`,
                borderRadius: 20, padding: "3px 9px",
                whiteSpace: "nowrap", flexShrink: 0,
              }}>
                {scenario.icon} {scenario.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation()
  const { group }   = useParams()
  usePageMeta(`Group ${group} — World Cup 2026`, `FIFA World Cup 2026 Group ${group} standings and match results.`)
  const navigate    = useNavigate()
  const onMatchClick = (m) => {
    if (m.external_id) navigate(`/matches/${m.external_id}`)
  }
  const [standings, setStandings] = useState([])

  const { matches, loading } = useMatches("all", { competition: "WC", group })

  useEffect(() => {
    fetch("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(data => setStandings((Array.isArray(data) ? data.filter(s => s.group_name === group) : data[group]) || []))
  }, [group])

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {/* Standings + Qualification */}
          <div className="col-lg-5 mb-4">
            <div className="widget-next-match">
              <div className="widget-title"><h3>{t("groups.standings", { letter: group })}</h3></div>
              <div className="widget-body p-0">
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table className="table custom-table mb-0" style={{ minWidth: 300 }}>
                    <thead>
                      <tr>
                        <th>{t("table.pos")}</th>
                        <th>{t("table.team")}</th>
                        <th>{t("table.played")}</th>
                        <th>{t("table.won")}</th>
                        <th>{t("table.drawn")}</th>
                        <th>{t("table.lost")}</th>
                        <th>{t("table.gd")}</th>
                        <th>{t("table.points")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: "center", color: "gray", padding: "1.5rem" }}>{t("groups.noStandings")}</td></tr>
                      ) : standings.map((s, i) => {
                        const complete   = standings.every(r => (r.played ?? 0) >= 3)
                        const a          = complete ? 1 : 0.4
                        const bg         = i === 0 ? `rgba(16,185,129,${0.1*a})` : i === 1 ? `rgba(16,185,129,${0.05*a})` : i === 2 ? `rgba(245,158,11,${0.05*a})` : `rgba(239,68,68,${0.04*a})`
                        const rankColor  = i === 0 || i === 1 ? "#10b981" : i === 2 ? "#f59e0b" : "#666"
                        const teamName   = translateTeam(s.team?.name, i18n.language)
                        return (
                          <tr key={s.team.id} style={{ background: bg }}>
                            <td style={{ color: rankColor, fontWeight: 700 }}>{s.rank}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {s.team.flag_url && <img src={s.team.flag_url} alt="" className="flag-xs" />}
                                <Link to={`/teams/${s.team.id}`} style={{ color: "#fff", fontWeight: 700 }}>{teamName}</Link>
                              </div>
                            </td>
                            <td>{s.played}</td><td>{s.won}</td><td>{s.drawn}</td><td>{s.lost}</td>
                            <td style={{ color: s.goal_diff > 0 ? "#10b981" : s.goal_diff < 0 ? "#ef4444" : "inherit" }}>
                              {s.goal_diff > 0 ? `+${s.goal_diff}` : s.goal_diff}
                            </td>
                            <td><strong className="text-white">{s.points}</strong></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Qualification scenarios */}
                <QualificationPanel standings={standings} t={t} lang={i18n.language} />
              </div>
            </div>
          </div>

          {/* Matches */}
          <div className="col-lg-7">
            <div className="widget-next-match">
              <div className="widget-title"><h3>{t("groups.matches", { letter: group })}</h3></div>
              <div className="widget-body p-0">
                {loading
                  ? <div className="loading-shimmer m-3" style={{ height: 200, borderRadius: 8 }} />
                  : matches.length === 0
                  ? <p style={{ color: "gray", textAlign: "center", padding: "2rem" }}>{t("noMatches")}</p>
                  : matches.map(m => <MatchRow key={m.id} match={m} showDate onClick={() => onMatchClick(m)} />)
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
