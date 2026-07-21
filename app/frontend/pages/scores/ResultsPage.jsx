import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateLeague, translateCountry } from "../../i18n/leagueNames"
import MatchRow from "../../components/MatchRow"
import { navigateToMatch } from "../../utils/matchDetailCache"
import { fetchWithTimeout } from "../../utils/fetchWithTimeout"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useAppFocus } from "../../hooks/useAppFocus"

function normalizeMatch(m) {
  return {
    id:          `real-${m.external_id}`,
    external_id: m.external_id,
    status:      m.status,
    kickoff_at:  m.kickoff_at,
    home_score:  m.home?.score ?? null,
    away_score:  m.away?.score ?? null,
    home_team:   { name: m.home?.name, flag_url: m.home?.logo },
    away_team:   { name: m.away?.name, flag_url: m.away?.logo },
    competition: {
      id:      `ext-${m.league_id}`,
      name:    m.league_name,
      logo:    m.league_logo,
      country: m.league_country,
    },
  }
}

function CompetitionBlock({ matches, onMatchClick }) {
  const { i18n } = useTranslation()
  const comp   = matches[0]?.competition
  const sorted = [...matches].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

  return (
    <div className="widget-next-match mb-4">
      <div className="widget-title d-flex align-items-center" style={{ gap: 10 }}>
        {comp?.logo && (
          <img src={comp.logo} alt="" className="logo-sm"
            onError={e => (e.target.style.display = "none")} />
        )}
        <h3 style={{ margin: 0 }}>{translateLeague(comp?.name, i18n.language) ?? "Other"}</h3>
        <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888" }}>{translateCountry(comp?.country, i18n.language)}</span>
      </div>
      <div className="widget-body p-0">
        {sorted.map(m => (
          <MatchRow
            key={m.id}
            match={m}
            kickoffBelowStatus
            showChevron
            showMeta
            onClick={() => onMatchClick(m)}
          />
        ))}
      </div>
    </div>
  )
}

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

function useResultLabel(date, t) {
  const yesterday = toISO(addDays(new Date(), -1))
  const today     = toISO(new Date())
  const iso       = toISO(date)
  if (iso === yesterday) return t("time.yesterday")
  if (iso === today)     return t("time.today")
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
}

export default function ResultsPage() {
  const { t }    = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  usePageMeta(
    t("nav.results"),
    clubsPrimary ? t("scores.metaDescResults") : t("scores.metaDescWC")
  )
  const [date, setDate]       = useState(() => new Date())
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const navigate = useNavigate()
  const onMatchClick = (match) => navigateToMatch(navigate, match)

  const load = useCallback((d) => {
    setLoading(true)
    setError(false)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetchWithTimeout(`/api/v1/results?date=${toISO(d)}&tz=${encodeURIComponent(tz)}`)
      .then(r => r.json())
      .then(data => {
        const finished = data.map(normalizeMatch).filter(m => m.status === "finished")
        setMatches(finished)
      })
      .catch(() => { setError(true); setMatches([]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(date) }, [date, load])

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT") return
      if (e.key === "ArrowLeft")  setDate(d => addDays(d, -1))
      if (e.key === "ArrowRight" && toISO(date) < toISO(new Date())) setDate(d => addDays(d, 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [date])

  const byLeague = matches.reduce((acc, m) => {
    const key = m.competition?.id ?? "other"
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  const groups = Object.values(byLeague).sort((a, b) =>
    (a[0]?.competition?.name ?? "").localeCompare(b[0]?.competition?.name ?? "")
  )

  const today = toISO(new Date())
  const label = useResultLabel(date, t)

  return (
    <div className="site-section">
      <div className="container">
        <div className="d-flex align-items-center justify-content-between mb-4" style={{ gap: 12 }}>
          <button className="btn-nav" onClick={() => setDate(d => addDays(d, -1))}>←</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>{label}</div>
            <div style={{ fontSize: "0.75rem", color: "#888" }}>{toISO(date)}</div>
          </div>
          <button
            className="btn-nav"
            onClick={() => setDate(d => addDays(d, 1))}
            disabled={toISO(date) >= today}
            style={{ opacity: toISO(date) >= today ? 0.3 : 1 }}
          >→</button>
        </div>

        {loading ? (
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        ) : error ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <p style={{ color: "#888", marginBottom: 16 }}>{t("error.failedToLoad")}</p>
            <button className="btn btn-primary btn-sm" onClick={() => load(date)}>{t("error.retry")}</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🏆</div>
            <h3>{t("time.noMatches", { date: label })}</h3>
            <p>{t("time.tryDifferent")}</p>
          </div>
        ) : (
          groups.map((g, i) => (
            <CompetitionBlock key={g[0]?.competition?.id ?? i} matches={g} onMatchClick={onMatchClick} />
          ))
        )}
      </div>
    </div>
  )
}
