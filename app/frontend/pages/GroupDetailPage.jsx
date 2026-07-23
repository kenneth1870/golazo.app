import { useParams, useNavigate, Link } from "react-router-dom"
import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useMatches } from "../hooks/useMatches"
import MatchRow from "../components/MatchRow"
import { navigateToMatch, navIdFor } from "../utils/matchDetailCache"
import { usePageMeta } from "../hooks/usePageMeta"
import { translateTeam } from "../i18n/teamNames"
import { GroupStandingsFullTable } from "../components/GroupStandingsView"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"
import { useStandingsChannel } from "../hooks/useStandingsChannel"
import { useVisiblePolling } from "../hooks/useVisiblePolling"

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
                <img src={s.team.flag_url} alt={s.team.name} style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 2, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 700, color: "var(--text)", minWidth: 0 }}>
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

// ─── Scenario builder: simulate remaining results ─────
function shortTeamLabel(name, lang) {
  const full = translateTeam(name, lang) || name || ""
  if (full.length <= 14) return full
  return full.split(/\s+/)[0]
}

function WhatIfPanel({ matches, standings, lang, t }) {
  const remaining = matches.filter(m => m.status === "scheduled" || m.status === "ns" || m.status === "NS")

  // overrides: { matchId: "home" | "away" | "draw" }
  const [overrides, setOverrides] = useState({})

  if (!standings?.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">🔮</div>
      <h3>{t("groups.whatIfNoStandings")}</h3>
    </div>
  )
  if (!remaining.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">✅</div>
      <h3>{t("groups.whatIfAllComplete")}</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{t("groups.whatIfNoUpcoming")}</p>
    </div>
  )

  // Simulate standings with overrides applied
  const simStandings = standings.map(s => ({
    ...s,
    pts: s.points ?? 0, gf: s.goals_for ?? 0, ga: s.goals_against ?? 0,
    gd: (s.goals_for ?? 0) - (s.goals_against ?? 0),
  }))
  const byName = Object.fromEntries(simStandings.map(s => [s.team?.name, s]))

  remaining.forEach(m => {
    const result = overrides[m.id]
    if (!result) return
    const home = byName[m.home_team?.name]
    const away = byName[m.away_team?.name]
    if (!home || !away) return
    if (result === "home") {
      home.pts += 3; home.gf += 1; away.ga += 1
      home.gd++; away.gd--
    } else if (result === "away") {
      away.pts += 3; away.gf += 1; home.ga += 1
      away.gd++; home.gd--
    } else {
      home.pts += 1; away.pts += 1
      home.gf += 1; away.gf += 1; home.ga += 1; away.ga += 1
    }
  })

  const sorted = [...simStandings].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
  const allSet  = remaining.every(m => overrides[m.id])

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: "0.78rem", color: "var(--muted)" }}>
        {t("groups.whatIfIntro")}
      </div>

      {/* Match result pickers */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {remaining.map(m => {
          const sel = overrides[m.id]
          const btn = (label, val) => (
            <button
              key={val}
              onClick={() => setOverrides(o => ({ ...o, [m.id]: val }))}
              style={{
                flex: 1, padding: "6px 4px", fontSize: "0.72rem", fontWeight: 700,
                borderRadius: 6, border: `1px solid ${sel === val ? "var(--accent)" : "var(--border)"}`,
                background: sel === val ? "rgba(238,30,70,.15)" : "var(--surface2)",
                color: sel === val ? "var(--accent)" : "var(--muted)", cursor: "pointer",
              }}
            >{label}</button>
          )
          return (
            <div key={m.id} style={{ background: "var(--surface)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: "0.8rem", fontWeight: 700, color: "var(--text)", justifyContent: "space-between" }}>
                <span style={{ flex: 1, textAlign: "right" }}>{translateTeam(m.home_team?.name, lang)}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--muted)", flexShrink: 0 }}>vs</span>
                <span style={{ flex: 1, textAlign: "left" }}>{translateTeam(m.away_team?.name, lang)}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {btn(t("groups.whatIfWin", { team: shortTeamLabel(m.home_team?.name, lang) }), "home")}
                {btn(t("groups.whatIfDraw"), "draw")}
                {btn(t("groups.whatIfWin", { team: shortTeamLabel(m.away_team?.name, lang) }), "away")}
              </div>
            </div>
          )
        })}
      </div>

      {/* Projected standings */}
      {allSet && (
        <div>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
            {t("groups.whatIfProjectedStandings")}
          </div>
          {sorted.map((s, i) => (
            <div key={s.team?.id ?? i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: i < 2 ? "rgba(16,185,129,.08)" : i === 2 ? "rgba(245,158,11,.06)" : "rgba(239,68,68,.05)",
              borderRadius: 8, marginBottom: 4,
              borderLeft: `3px solid ${i < 2 ? "#10b981" : i === 2 ? "#f59e0b" : "#ef4444"}`,
            }}>
              <span style={{ width: 20, fontWeight: 900, fontSize: "0.8rem", color: i < 2 ? "#10b981" : i === 2 ? "#f59e0b" : "#ef4444" }}>#{i + 1}</span>
              {s.team?.flag_url && <img src={s.team.flag_url} alt={s.team.name} style={{ width: 22, height: 22, objectFit: "contain" }} />}
              <span style={{ flex: 1, fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>{translateTeam(s.team?.name, lang)}</span>
              <span style={{ fontWeight: 900, fontSize: "0.9rem", color: "var(--text)" }}>{s.pts}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--muted)", marginLeft: 2 }}>{t("groups.whatIfPts")}</span>
              <span style={{ fontSize: "0.72rem", color: s.gd > 0 ? "#10b981" : s.gd < 0 ? "#ef4444" : "var(--muted)", marginLeft: 8, minWidth: 28, textAlign: "right" }}>
                {s.gd > 0 ? `+${s.gd}` : s.gd} {t("groups.whatIfGd")}
              </span>
            </div>
          ))}
          <button
            onClick={() => setOverrides({})}
            style={{
              marginTop: 12, display: "block", width: "100%", padding: "8px", fontSize: "0.75rem",
              background: "none", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--muted)", cursor: "pointer",
            }}
          >
            {t("groups.whatIfReset")}
          </button>
        </div>
      )}
    </div>
  )
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation()
  const { group }   = useParams()
  usePageMeta(t("groups.metaTitle", { letter: group }), t("groups.metaDesc", { letter: group }))
  const navigate    = useNavigate()
  const onMatchClick = (m) => navigateToMatch(navigate, m)
  const [standings, setStandings] = useState([])
  const [standingsLoading, setStandingsLoading] = useState(false)
  const [standingsError, setStandingsError] = useState(false)
  const [stale, setStale]                   = useState(false)
  const [activeTab, setActiveTab] = useState("standings")

  const { matches, loading, refetch: refetchMatches, stale: matchesStale } = useMatches("all", { competition: "WC", group })

  const loadStandings = useCallback(() => {
    setStandingsError(false)
    setStale(false)
    setStandingsLoading(true)
    return fetchJson("/api/v1/standings?competition=WC")
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) {
          setStandingsError(true)
          return
        }
        setStandings((Array.isArray(data) ? data.filter(s => s.group_name === group) : data[group]) || [])
      })
      .catch(() => { setStandings([]); setStandingsError(true) })
      .finally(() => setStandingsLoading(false))
  }, [group])

  const onStandingsUpdate = useCallback(() => {
    loadStandings()
    refetchMatches()
  }, [refetchMatches]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStandings() }, [loadStandings])
  useStandingsChannel(onStandingsUpdate)

  // Auto-refresh standings every 30s when group has a live match (visible tabs only)
  const hasLiveInGroup = matches.some(m =>
    m.status === "live" || ["1H","2H","HT","ET","BT","P"].includes(m.status?.short ?? "")
  )
  useVisiblePolling(loadStandings, hasLiveInGroup ? 30000 : null, [group])

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
    { key: "whatif",    label: t("groups.whatIfTab") },
  ]

  return (
    <div className="site-section">
      <div className="container">
        <OfflineBanner stale={stale || matchesStale} onRetry={() => { loadStandings(); refetchMatches() }} />

        {/* Mobile tabs */}
        <div className="tab-bar d-lg-none" style={{ marginBottom: 16 }}>
          <div className="tab-bar__inner tab-bar__inner--scroll" role="tablist">
            {TABS.map(tab => (
              <button key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls={`group-tab-${tab.key}`}
                className={`tab-link${activeTab === tab.key ? " tab-link--active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.key === "standings" && hasLiveInGroup && (
                  <span style={{ marginLeft: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", verticalAlign: "middle" }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          {/* Standings + Qualification — hidden on mobile when schedule or whatif tab active */}
          <div className={`col-lg-5 mb-4${activeTab === "schedule" || activeTab === "whatif" ? " d-none d-lg-block" : ""}${activeTab === "whatif" ? " d-none" : ""}`}>
            <div className="widget-next-match">
              <div className="widget-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0 }}>{t("groups.standings", { letter: group })}</h3>
                {hasLiveInGroup && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.65rem", color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    {t("groups.liveUpdate")}
                  </span>
                )}
              </div>
              <div className="widget-body p-0">
                {standingsLoading ? (
                  <div className="loading-shimmer" style={{ height: 200, margin: 16, borderRadius: 8 }} />
                ) : standingsError ? (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: .3 }}>📊</div>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
                    <button className="btn btn-sm btn-outline-light" onClick={loadStandings}>{t("error.retry")}</button>
                  </div>
                ) : (
                <GroupStandingsFullTable rows={standings} t={t} lang={i18n.language} />
                )}

                {/* Qualification scenarios */}
                {!standingsLoading && !standingsError && (
                  <QualificationPanel standings={standings} t={t} lang={i18n.language} />
                )}
              </div>
            </div>
          </div>

          {/* Schedule — hidden on mobile when standings tab active */}
          {/* What If tab — full width */}
          {activeTab === "whatif" && (
            <div className="col-12">
              <div className="widget-next-match">
                <div className="widget-title"><h3>🔮 {t("groups.whatIfTab")}</h3></div>
                <div className="widget-body" style={{ padding: "16px" }}>
                  <WhatIfPanel matches={matches} standings={standings} lang={i18n.language} t={t} />
                </div>
              </div>
            </div>
          )}

          <div className={`col-lg-7${activeTab === "standings" ? " d-none d-lg-block" : ""}${activeTab === "whatif" ? " d-none" : ""}`}>
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
                          {hasLive && <span className="live-badge" style={{ marginLeft: "auto" }}>{t("status.live")}</span>}
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
