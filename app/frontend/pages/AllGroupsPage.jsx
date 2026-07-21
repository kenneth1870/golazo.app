import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStandingsChannel } from "../hooks/useStandingsChannel"

// WC 2026: pos 0-1 qualify directly, pos 2 potentially (best 8 of 12 third-place), pos 3 eliminated
function rowQualStyle(rank, rows) {
  const complete = rows.length > 0 && rows.every(r => (r.played ?? 0) >= 3)
  const alpha     = complete ? 1 : 0.45
  if (rank === 0) return { background: `rgba(16,185,129,${0.12 * alpha})`,  borderLeft: `2px solid rgba(16,185,129,${alpha})` }
  if (rank === 1) return { background: `rgba(16,185,129,${0.07 * alpha})`,  borderLeft: `2px solid rgba(16,185,129,${alpha * 0.6})` }
  if (rank === 2) return { background: `rgba(245,158,11,${0.07 * alpha})`,  borderLeft: `2px solid rgba(245,158,11,${alpha * 0.5})` }
  return           { background: `rgba(239,68,68,${0.05 * alpha})`,          borderLeft: "2px solid transparent" }
}

function StandingsTable({ group, rows, onNavigate, t, i18n }) {
  return (
    <div className="widget-next-match mb-4" style={{ cursor: "default" }}>
      <div
        className="widget-title d-flex align-items-center"
        style={{ gap: 8, cursor: "pointer" }}
        onClick={onNavigate}
      >
        <h3 style={{ margin: 0 }}>{t("nav.group", { letter: group })}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#ee1e46" }}>{t("standings.matchesLink")}</span>
      </div>
      <div className="widget-body p-0" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div className="bracket-scroll-hint" style={{ marginBottom: 4 }}>{t("bracket.swipeHint")}</div>
        <table className="table custom-table mb-0" style={{ fontSize: "0.8rem", minWidth: 380 }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>{t("table.pos")}</th>
              <th>{t("table.team")}</th>
              <th title={t("table.played")} style={{ textAlign: "center" }}>{t("table.played")}</th>
              <th title={t("table.won")}    style={{ textAlign: "center" }}>{t("table.won")}</th>
              <th title={t("table.drawn")}  style={{ textAlign: "center" }}>{t("table.drawn")}</th>
              <th title={t("table.lost")}   style={{ textAlign: "center" }}>{t("table.lost")}</th>
              <th title="Goals For"         style={{ textAlign: "center" }}>{t("table.gf")}</th>
              <th title="Goals Against"     style={{ textAlign: "center" }}>{t("table.ga")}</th>
              <th title={t("table.gd")}     style={{ textAlign: "center" }}>{t("table.gd")}</th>
              <th title={t("table.points")} style={{ textAlign: "center", fontWeight: 700 }}>{t("table.points")}</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "#555", padding: "1.2rem", fontSize: "0.75rem" }}>
                  {t("groups.noStandingsYet")}
                </td>
              </tr>
            ) : rows.map((s, i) => {
              const qs = rowQualStyle(i, rows)
              return (
              <tr key={s.team?.id ?? i} style={{ ...qs }}>
                <td style={{ color: i < 2 ? "#10b981" : i === 2 ? "#f59e0b" : "#666", fontWeight: 700 }}>{s.rank ?? i + 1}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {s.team?.flag_url && (
                      <img src={s.team.flag_url} alt={s.team.name} className="flag-xs" loading="eager"
                        onError={e => (e.target.style.display = "none")} />
                    )}
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{translateTeam(s.team?.name, i18n.language)}</span>
                  </div>
                </td>
                <td style={{ textAlign: "center" }}>{s.played ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.won ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.drawn ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.lost ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.goals_for ?? 0}</td>
                <td style={{ textAlign: "center" }}>{s.goals_against ?? 0}</td>
                <td style={{ textAlign: "center", color: (s.goal_diff ?? 0) > 0 ? "#10b981" : (s.goal_diff ?? 0) < 0 ? "#ef4444" : "#aaa" }}>
                  {(s.goal_diff ?? 0) > 0 ? `+${s.goal_diff}` : s.goal_diff ?? 0}
                </td>
                <td style={{ textAlign: "center" }}>
                  <strong style={{ color: "var(--text)" }}>{s.points ?? 0}</strong>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const GROUP_LETTERS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function AllGroupsPage() {
  const { t, i18n } = useTranslation()
  usePageMeta("Groups", "FIFA World Cup 2026 group standings — all 12 groups with points, goals and results.")
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch("/api/v1/standings?competition=WC")
      .then(r => r.json())
      .then(data => setGrouped(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useStandingsChannel(load)

  const groups = GROUP_LETTERS.filter(g => grouped[g]?.length > 0)
  const displayGroups = groups.length > 0 ? groups : GROUP_LETTERS

  if (loading) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="row">
            {GROUP_LETTERS.map(g => (
              <div key={g} className="col-lg-6 mb-4">
                <div className="loading-shimmer" style={{ height: 200, borderRadius: 8 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="site-section">
        <div className="container" style={{ textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
          <button className="btn btn-primary btn-sm" onClick={load}>{t("error.retry")}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        <div className="qualify-legend" style={{ marginBottom: 20 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#10b981" }} /> {t("standings.qualified")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#f59e0b" }} /> {t("standings.possibleThird")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#ef4444" }} /> {t("standings.eliminated")}</span>
          <span style={{ marginLeft: "auto", opacity: .5 }}>{t("standings.provisional")}</span>
        </div>
        <div className="row">
          {displayGroups.map(g => (
            <div key={g} className="col-lg-6 mb-4">
              <StandingsTable
                group={g}
                rows={grouped[g] || []}
                onNavigate={() => navigate(`/groups/${g}`)}
                t={t}
                i18n={i18n}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
