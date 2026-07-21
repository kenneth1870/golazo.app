import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches } from "../../hooks/useMatches"
import MatchRow from "../../components/MatchRow"
import { usePageMeta } from "../../hooks/usePageMeta"
import { navigateToMatch, navIdFor } from "../../utils/matchDetailCache"
import { useStandingsChannel } from "../../hooks/useStandingsChannel"
import { useVisiblePolling } from "../../hooks/useVisiblePolling"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

function MiniStandingsTable({ group, rows }) {
  const { t } = useTranslation()
  if (!rows?.length) return null
  return (
    <div>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", marginTop: 0, minWidth: 260 }}>
      <thead>
        <tr style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>
          <th style={{ textAlign: "left",  padding: "3px 6px", fontWeight: 600 }}>{t("table.team")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.played")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.won")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.drawn")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.lost")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.gd")}</th>
          <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700, color: "var(--accent)" }}>{t("table.points")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const complete = rows.every(r => (r.played ?? 0) >= 3)
          const a = complete ? 1 : 0.4
          const bg = i === 0 ? `rgba(16,185,129,${0.1*a})` : i === 1 ? `rgba(16,185,129,${0.05*a})` : i === 2 ? `rgba(245,158,11,${0.05*a})` : `rgba(239,68,68,${0.04*a})`
          return (
          <tr key={s.team?.id ?? i} style={{ borderTop: "1px solid var(--border)", background: bg }}>
            <td style={{ padding: "5px 6px", display: "flex", alignItems: "center", gap: 6 }}>
              {i < 2 && <span style={{ width: 3, height: 14, borderRadius: 2, background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />}
              {s.team?.flag_url && <img src={s.team.flag_url} alt={s.team.name} loading="eager" style={{ width: 16, height: 11, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} onError={e => (e.target.style.display = "none")} />}
              <Link to={`/teams/${s.team?.id}`} style={{ color: "var(--text)", textDecoration: "none", fontWeight: i < 2 ? 700 : 400 }}>
                {s.team?.code || s.team?.name}
              </Link>
            </td>
            <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.played ?? 0}</td>
            <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.won ?? 0}</td>
            <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.drawn ?? 0}</td>
            <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.lost ?? 0}</td>
            <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>
              {(s.goal_diff ?? 0) > 0 ? `+${s.goal_diff}` : s.goal_diff ?? 0}
            </td>
            <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 800, color: "var(--text)" }}>{s.points ?? 0}</td>
          </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

function BestThirdsTable({ rows }) {
  const { t } = useTranslation()
  if (!rows?.length) return null
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", minWidth: 300 }}>
        <thead>
          <tr style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>
            <th style={{ textAlign: "center", padding: "3px 6px", fontWeight: 600, width: 28 }}>#</th>
            <th style={{ textAlign: "left",   padding: "3px 6px", fontWeight: 600 }}>{t("table.team")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.played")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.won")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.drawn")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.lost")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.gd")}</th>
            <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700, color: "var(--accent)" }}>{t("table.points")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const advances = i < 8
            const bg = advances
              ? `rgba(16,185,129,${i < 4 ? 0.1 : 0.05})`
              : "rgba(239,68,68,0.04)"
            return (
              <tr key={s.team?.id ?? i} style={{ borderTop: "1px solid var(--border)", background: bg }}>
                <td style={{ textAlign: "center", padding: "5px 6px", color: "var(--muted)", fontWeight: 600 }}>
                  {s.rank}
                </td>
                <td style={{ padding: "5px 6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {advances && <span style={{ width: 3, height: 14, borderRadius: 2, background: "#10b981", display: "inline-block", flexShrink: 0 }} />}
                    {s.team?.flag_url && <img src={s.team.flag_url} alt={s.team.name} loading="eager" style={{ width: 16, height: 11, objectFit: "cover", borderRadius: 1, flexShrink: 0 }} onError={e => (e.target.style.display = "none")} />}
                    <Link to={`/teams/${s.team?.id}`} style={{ color: "var(--text)", textDecoration: "none", fontWeight: advances ? 700 : 400 }}>
                      {s.team?.code || s.team?.name}
                    </Link>
                    {s.team?.group && <span style={{ fontSize: "0.65rem", color: "var(--muted)", marginLeft: 2 }}>({s.team.group})</span>}
                  </div>
                </td>
                <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.played ?? 0}</td>
                <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.won ?? 0}</td>
                <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.drawn ?? 0}</td>
                <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.lost ?? 0}</td>
                <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>
                  {(s.goal_diff ?? 0) > 0 ? `+${s.goal_diff}` : s.goal_diff ?? 0}
                </td>
                <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 800, color: "var(--text)" }}>{s.points ?? 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function GroupStagePage() {
  const { t } = useTranslation()
  usePageMeta(t("nav.groupStage"), "FIFA World Cup 2026 group stage matches — all 72 group fixtures across 12 groups.")
  const { matches, loading } = useMatches("all", { competition: "WC" })
  const navigate = useNavigate()
  const [standings, setStandings] = useState({})
  const [bestThirds, setBestThirds] = useState([])

  const hasLiveOrRecent = matches.some(m =>
    m.status === "live" ||
    (m.status === "finished" && m.kickoff_at && new Date() - new Date(m.kickoff_at) < 3 * 60 * 60 * 1000)
  )

  const loadStandings = () => fetch("/api/v1/standings?competition=WC", { cache: "no-store" })
    .then(r => r.json())
    .then(setStandings)
    .catch(() => {})

  const loadBestThirds = () => fetch("/api/v1/standings/best_thirds", { cache: "no-store" })
    .then(r => r.json())
    .then(setBestThirds)
    .catch(() => {})

  useEffect(() => {
    loadStandings()
    loadBestThirds()
  }, [hasLiveOrRecent])

  // Refresh standings on an interval (30s with live/recent matches, 60s
  // otherwise), paused while the tab is hidden.
  useVisiblePolling(() => { loadStandings(); loadBestThirds() }, hasLiveOrRecent ? 30_000 : 60_000)

  useStandingsChannel(loadStandings)

  const groupMatches = matches.filter(m => m.group_stage)
  const byGroup = GROUPS.reduce((acc, g) => {
    acc[g] = groupMatches.filter(m => m.group_stage === g)
    return acc
  }, {})

  if (loading) return <div className="site-section container"><div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} /></div>

  return (
    <div className="site-section">
      <div className="container">
        <div className="row">
          {GROUPS.filter(g => byGroup[g].length > 0).map(g => (
            <div key={g} className="col-lg-6 mb-5">
              <div className="group-matches-card">
                <div className="group-matches-card__header">
                  <span>{t("nav.group", { letter: g })}</span>
                  <Link to={`/groups/${g}`} className="group-link" style={{ textDecoration: "none" }}>
                    {t("groups.viewStandings")}
                  </Link>
                </div>

                {/* Mini standings table */}
                <MiniStandingsTable group={g} rows={standings[g]} />

                {/* Matches */}
                <div className="match-list match-list--compact" style={{ marginTop: 10 }}>
                  {byGroup[g].map(m => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      showDate
                      showMeta={false}
                      onClick={() => navIdFor(m) ? navigateToMatch(navigate, m) : navigate(`/groups/${g}`)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Best Third-placed Teams */}
        {bestThirds.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <div style={{
              fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)",
              textTransform: "uppercase", letterSpacing: ".08em",
              marginBottom: 12,
            }}>
              {t("table.bestThirds", "Mejores Terceros")}
            </div>
            <div className="group-matches-card" style={{ padding: "12px 16px" }}>
              <BestThirdsTable rows={bestThirds} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
