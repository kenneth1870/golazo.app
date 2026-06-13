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
  const [activeTab, setActiveTab] = useState("standings")

  const { matches, loading } = useMatches("all", { competition: "WC", group })

  const loadStandings = () =>
    fetch("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(data => setStandings((Array.isArray(data) ? data.filter(s => s.group_name === group) : data[group]) || []))

  useEffect(() => { loadStandings() }, [group]) // eslint-disable-line

  // Auto-refresh standings every 30s when group has a live match
  const hasLiveInGroup = matches.some(m =>
    m.status === "live" || ["1H","2H","HT","ET","BT","P"].includes(m.status?.short ?? "")
  )
  useEffect(() => {
    if (!hasLiveInGroup) return
    const iv = setInterval(loadStandings, 30000)
    return () => clearInterval(iv)
  }, [hasLiveInGroup, group]) // eslint-disable-line

  // Group matches by date → matchday labels
  const matchDays = matches.reduce((acc, m) => {
    const dateKey = m.kickoff_at
      ? new Date(m.kickoff_at).toLocaleDateString("en-CA") // YYYY-MM-DD
      : "tbd"
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(m)
    return acc
  }, {})
  const matchDayEntries = Object.entries(matchDays).sort(([a], [b]) => a.localeCompare(b))

  const TABS = [
    { key: "standings", label: t("groups.standings", { letter: group }) },
    { key: "schedule",  label: t("groups.schedule") },
  ]

  return (
    <div className="site-section">
      <div className="container">

        {/* Mobile tabs */}
        <div className="tab-bar d-lg-none" style={{ marginBottom: 16 }}>
          <div className="tab-bar__inner">
            {TABS.map(tab => (
              <button key={tab.key}
                className={`tab-link${activeTab === tab.key ? " tab-link--active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key === "standings" && hasLiveInGroup && (
                  <span style={{ marginLeft: 5, width: 6, height: 6, borderRadius: "50%", background: "#ee1e46", display: "inline-block", verticalAlign: "middle" }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          {/* Standings + Qualification — hidden on mobile when schedule tab active */}
          <div className={`col-lg-5 mb-4${activeTab === "schedule" ? " d-none d-lg-block" : ""}`}>
            <div className="widget-next-match">
              <div className="widget-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0 }}>{t("groups.standings", { letter: group })}</h3>
                {hasLiveInGroup && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: "#ee1e46", fontWeight: 700, marginLeft: "auto" }}>
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    {t("groups.liveUpdate")}
                  </span>
                )}
              </div>
              <div className="widget-body p-0">
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table className="table custom-table mb-0" style={{ minWidth: 320 }}>
                    <thead>
                      <tr>
                        <th>{t("table.pos")}</th>
                        <th>{t("table.team")}</th>
                        <th title="Matches Played">{t("table.played")}</th>
                        <th title="Won">{t("table.won")}</th>
                        <th title="Drawn">{t("table.drawn")}</th>
                        <th title="Lost">{t("table.lost")}</th>
                        <th title="Goals For">{t("table.gf")}</th>
                        <th title="Goals Against">{t("table.ga")}</th>
                        <th title="Goal Difference">{t("table.gd")}</th>
                        <th>{t("table.points")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: "center", padding: "2rem" }}>
                            <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: .3 }}>🏆</div>
                            <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{t("groups.noStandingsYet")}</div>
                          </td>
                        </tr>
                      ) : standings.map((s, i) => {
                        const complete  = standings.every(r => (r.played ?? 0) >= 3)
                        const a         = complete ? 1 : 0.4
                        const bg        = i === 0 ? `rgba(16,185,129,${0.1*a})` : i === 1 ? `rgba(16,185,129,${0.05*a})` : i === 2 ? `rgba(245,158,11,${0.05*a})` : `rgba(239,68,68,${0.04*a})`
                        const rankColor = i === 0 || i === 1 ? "#10b981" : i === 2 ? "#f59e0b" : "#666"
                        const teamName  = translateTeam(s.team?.name, i18n.language)
                        const gd        = s.goal_diff ?? (s.goals_for != null ? s.goals_for - (s.goals_against ?? 0) : null)
                        return (
                          <tr key={s.team.id} style={{ background: bg }}>
                            <td style={{ color: rankColor, fontWeight: 700 }}>{s.rank ?? i + 1}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {s.team.flag_url && <img src={s.team.flag_url} alt="" className="flag-xs" />}
                                <Link to={`/teams/${s.team.id}`} style={{ color: "#fff", fontWeight: 700 }}>{teamName}</Link>
                              </div>
                            </td>
                            <td>{s.played ?? 0}</td>
                            <td>{s.won ?? 0}</td>
                            <td>{s.drawn ?? 0}</td>
                            <td>{s.lost ?? 0}</td>
                            <td>{s.goals_for ?? s.gf ?? "–"}</td>
                            <td>{s.goals_against ?? s.ga ?? "–"}</td>
                            <td style={{ color: gd > 0 ? "#10b981" : gd < 0 ? "#ef4444" : "inherit" }}>
                              {gd != null ? (gd > 0 ? `+${gd}` : gd) : "–"}
                            </td>
                            <td><strong className="text-white">{s.points ?? 0}</strong></td>
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

          {/* Schedule — hidden on mobile when standings tab active */}
          <div className={`col-lg-7${activeTab === "standings" ? " d-none d-lg-block" : ""}`}>
            <div className="widget-next-match">
              <div className="widget-title"><h3>{t("groups.schedule")}</h3></div>
              <div className="widget-body p-0">
                {loading ? (
                  <>
                    {[1,2,3].map(i => <div key={i} className="loading-shimmer mx-3 my-2" style={{ height: 52, borderRadius: 8 }} />)}
                  </>
                ) : matches.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: .3 }}>📅</div>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{t("noMatches")}</p>
                  </div>
                ) : (
                  matchDayEntries.map(([dateKey, dayMatches], dayIdx) => {
                    const dateLabel = dateKey === "tbd" ? "TBD"
                      : new Date(dateKey + "T12:00:00").toLocaleDateString(i18n.language || undefined, { weekday: "long", month: "long", day: "numeric" })
                    const hasLive = dayMatches.some(m => m.status === "live")
                    return (
                      <div key={dateKey}>
                        {/* Matchday divider */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 16px 6px",
                          borderTop: dayIdx > 0 ? "1px solid var(--border)" : "none",
                        }}>
                          <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
                            {t("groups.matchday", { n: dayIdx + 1 })}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{dateLabel}</span>
                          {hasLive && <span className="live-badge" style={{ marginLeft: "auto" }}>LIVE</span>}
                        </div>
                        {dayMatches
                          .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
                          .map(m => (
                            <MatchRow key={m.id} match={m} showDate={false} onClick={() => onMatchClick(m)} />
                          ))
                        }
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
