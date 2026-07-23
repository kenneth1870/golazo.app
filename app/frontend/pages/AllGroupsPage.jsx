import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { GroupStandingsFullTable } from "../components/GroupStandingsView"
import OfflineBanner from "../components/OfflineBanner"
import { fetchJson } from "../utils/fetchJson"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStandingsChannel } from "../hooks/useStandingsChannel"

const GROUP_LETTERS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

function StandingsBlock({ group, rows, onNavigate, t, i18n }) {
  return (
    <div className="widget-next-match mb-4" style={{ cursor: "default" }}>
      <div
        className="widget-title d-flex align-items-center"
        style={{ gap: 8, cursor: "pointer" }}
        onClick={onNavigate}
      >
        <h3 style={{ margin: 0 }}>{t("nav.group", { letter: group })}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--accent)" }}>{t("standings.matchesLink")}</span>
      </div>
      <div className="widget-body p-0">
        <GroupStandingsFullTable rows={rows} t={t} lang={i18n.language} linkTeam={false} />
      </div>
    </div>
  )
}

export default function AllGroupsPage() {
  const { t, i18n } = useTranslation()
  usePageMeta("Groups", "FIFA World Cup 2026 group standings — all 12 groups with points, goals and results.")
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [stale, setStale]     = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    setError(false)
    setStale(false)
    fetchJson("/api/v1/standings?competition=WC")
      .then(({ data, stale: isStale, offline, ok }) => {
        setStale(isStale)
        if (!ok || offline) {
          setError(true)
          return
        }
        setGrouped(data || {})
      })
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
          <OfflineBanner stale={stale} onRetry={load} />
          <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
          <button className="btn btn-primary btn-sm" onClick={load}>{t("error.retry")}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="site-section">
      <div className="container">
        <OfflineBanner stale={stale} onRetry={load} />
        <div className="qualify-legend" style={{ marginBottom: 20 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#10b981" }} /> {t("standings.qualified")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#f59e0b" }} /> {t("standings.possibleThird")}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span className="qualify-legend__dot" style={{ background: "#ef4444" }} /> {t("standings.eliminated")}</span>
          <span style={{ marginLeft: "auto", opacity: .5 }}>{t("standings.provisional")}</span>
        </div>
        <div className="row">
          {displayGroups.map(g => (
            <div key={g} className="col-lg-6 mb-4">
              <StandingsBlock
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
