import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague } from "../../i18n/leagueNames"
import MatchRow from "../../components/MatchRow"
import { usePageMeta } from "../../hooks/usePageMeta"
import { fetchWithTimeout } from "../../utils/fetchWithTimeout"
import { useReminders } from "../../hooks/useReminders"

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function useDateLabel(date, t) {
  const todayISO     = toISO(new Date())
  const tomorrowISO  = toISO(addDays(new Date(), 1))
  const yesterdayISO = toISO(addDays(new Date(), -1))
  const iso          = toISO(date)
  if (iso === todayISO)     return t("time.today")
  if (iso === tomorrowISO)  return t("time.tomorrow")
  if (iso === yesterdayISO) return t("time.yesterday")
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
}

function DateStrip({ selected, onChange }) {
  const todayISO    = toISO(new Date())
  const selectedISO = toISO(selected)
  const days        = Array.from({ length: 7 }, (_, i) => addDays(selected, i - 3))

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
      <button className="btn-nav" style={{ flexShrink: 0 }} onClick={() => onChange(addDays(selected, -1))}>←</button>
      <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center", flexWrap: "nowrap" }}>
        {days.map(d => {
          const iso     = toISO(d)
          const isToday = iso === todayISO
          const isSel   = iso === selectedISO
          return (
            <button
              key={iso}
              onClick={() => onChange(d)}
              style={{
                background:   isSel ? "var(--accent, #ee1e46)" : isToday ? "rgba(238,30,70,0.15)" : "var(--surface2, #1a1a1a)",
                color:        isSel ? "#fff" : isToday ? "var(--accent, #ee1e46)" : "var(--muted, #888)",
                border:       isSel ? "1px solid var(--accent, #ee1e46)" : "1px solid var(--border, #2a2a2a)",
                borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                fontSize: "0.72rem", fontWeight: isSel ? 700 : 400,
                whiteSpace: "nowrap", transition: "all 0.15s", minWidth: 52, textAlign: "center",
              }}
            >
              <div style={{ fontWeight: isSel || isToday ? 700 : 400 }}>
                {d.toLocaleDateString([], { weekday: "short" })}
              </div>
              <div style={{ fontSize: "0.68rem", opacity: 0.8 }}>
                {d.toLocaleDateString([], { month: "short", day: "numeric" })}
              </div>
            </button>
          )
        })}
      </div>
      <button className="btn-nav" style={{ flexShrink: 0 }} onClick={() => onChange(addDays(selected, 1))}>→</button>
    </div>
  )
}

function BellButton({ match }) {
  const { isReminded, addReminder, removeReminder } = useReminders()
  const id = String(match.external_id || match.id)
  const reminded = isReminded(id)
  const toggle = async (e) => {
    e.stopPropagation()
    if (reminded) removeReminder(id)
    else await addReminder(match)
  }
  return (
    <button
      onClick={toggle}
      title={reminded ? "Remove reminder" : "Remind me at kickoff"}
      style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: "1rem", padding: "4px 6px", lineHeight: 1,
        opacity: reminded ? 1 : 0.35, transition: "opacity .2s",
      }}
    >
      {reminded ? "🔔" : "🔕"}
    </button>
  )
}

function CompetitionBlock({ matches, navigate, onMatchClick }) {
  const { i18n } = useTranslation()
  const comp   = matches[0]?.competition
  const canNav = comp?.code && !String(comp.code).match(/^\d+$/)
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

  return (
    <div className="widget-next-match mb-4">
      <div
        className={`widget-title d-flex align-items-center${canNav ? " cursor-pointer" : ""}`}
        style={{ gap: 10, cursor: canNav ? "pointer" : "default" }}
        onClick={canNav ? () => navigate(`/leagues/${comp.code}`) : undefined}
      >
        {comp?.logo && (
          <img src={comp.logo} alt="" className="logo-sm" onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{translateLeague(comp?.name, i18n.language) ?? "Other"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{comp?.country}</span>
        {canNav && <span style={{ fontSize: "0.75rem", color: "#ee1e46" }}>→</span>}
      </div>
      <div className="widget-body p-0">
        {sorted.map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <MatchRow match={m} onClick={() => onMatchClick(m)} />
            </div>
            {m.status === "scheduled" && m.kickoff_at && new Date(m.kickoff_at) > new Date() && (
              <BellButton match={m} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FixturesPage() {
  const { t }    = useTranslation()
  usePageMeta(t("nav.fixtures"), "Upcoming football fixtures — kickoff times and schedules for all competitions.")
  const [selected, setSelected] = useState(() => addDays(new Date(), 1))
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const navigate = useNavigate()
  const onMatchClick = (m) => {
    if (m.external_id) navigate(`/matches/${m.external_id}`)
    else navigate(`/matches/db-${m.id}`)
  }

  const load = useCallback((date) => {
    setLoading(true)
    setError(false)
    fetchWithTimeout(`/api/v1/fixtures?date=${toISO(date)}`)
      .then(r => r.json())
      .then(setMatches)
      .catch(() => { setError(true); setMatches([]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(selected) }, [selected, load])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return
      if (e.key === "ArrowLeft")  setSelected(d => addDays(d, -1))
      if (e.key === "ArrowRight") setSelected(d => addDays(d,  1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const byComp = matches.reduce((acc, m) => {
    const key = m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const groups = Object.values(byComp).sort((a, b) =>
    (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
  )

  const label = useDateLabel(selected, t)

  return (
    <div className="site-section">
      <div className="container">
        <div className="mb-4">
          <DateStrip selected={selected} onChange={d => { setSelected(d); setMatches([]) }} />
        </div>

        <div className="d-flex align-items-center justify-content-between mb-3" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#fff" }}>{label}</div>
          {!loading && (
            <span style={{ fontSize: "0.78rem", color: "#555" }}>{t("time.matchCount", { count: matches.length })}</span>
          )}
        </div>

        {loading ? (
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : error ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ color: "#888", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
            <button className="btn btn-primary btn-sm" onClick={() => load(selected)}>{t("error.retry")}</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__pitch" />
            <div className="empty-state__icon">📅</div>
            <h3>{t("time.noMatches", { date: label })}</h3>
            <p>{t("time.tryDifferent")}</p>
          </div>
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock key={g[0]?.competition?.id ?? i} matches={g} navigate={navigate} onMatchClick={onMatchClick} />
          ))
        )}
      </div>
    </div>
  )
}
