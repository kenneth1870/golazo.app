import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam, resolveTeamLogo } from "../i18n/teamNames"
import { translateLeague, translateCountry } from "../i18n/leagueNames"
import MatchRow from "../components/MatchRow"
import { useFavorites } from "../hooks/useFavorites"
import { usePageMeta } from "../hooks/usePageMeta"
import { navigateToMatch, navIdFor } from "../utils/matchDetailCache"
import { useLiveScoresChannel } from "../hooks/useLiveScoresChannel"
import { clubTeamPath } from "../utils/clubTeamPath"

function flattenStandings(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") return Object.values(data).flat()
  return []
}

function StandingsTable({ standings, t, i18n, leagueCode }) {
  if (!standings || standings.length === 0) return null

  // Group by group_name if present
  const groups = standings.reduce((acc, s) => {
    const g = s.group_name || "Overall"
    if (!acc[g]) acc[g] = []
    acc[g].push(s)
    return acc
  }, {})

  return (
    <>
      {Object.entries(groups).map(([group, rows]) => (
        <div key={group} className="mb-4">
          {group !== "Overall" && (
            <div className="fixture-day__header">{t("table.group")} {group}</div>
          )}
          <div className="table-responsive">
            <table className="table custom-table">
              <thead>
                <tr>
                  <th>{t("table.pos")}</th>
                  <th>{t("table.team")}</th>
                  <th>{t("table.played")}</th>
                  <th>{t("table.won")}</th>
                  <th>{t("table.drawn")}</th>
                  <th>{t("table.lost")}</th>
                  <th>{t("table.gf")}</th>
                  <th>{t("table.ga")}</th>
                  <th>{t("table.gd")}</th>
                  <th>{t("table.points")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.id ?? s.rank}>
                    <td style={{ color: "#888" }}>{s.rank}</td>
                    <td>
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        {s.team?.flag_url && (
                          <img
                            src={resolveTeamLogo(s.team?.name, s.team.flag_url)}
                            alt={s.team.name}
                            className="flag-xs"
                            loading="eager"
                            onError={e => (e.target.style.display = "none")}
                          />
                        )}
                        <strong style={{ color: "var(--text)" }}>
                          {leagueCode ? (
                            <Link
                              to={clubTeamPath(leagueCode, s.team?.name)}
                              style={{ color: "inherit", textDecoration: "none" }}
                            >
                              {translateTeam(s.team?.name, i18n.language)}
                            </Link>
                          ) : (
                            translateTeam(s.team?.name, i18n.language)
                          )}
                        </strong>
                      </div>
                    </td>
                    <td>{s.played}</td>
                    <td>{s.won}</td>
                    <td>{s.drawn}</td>
                    <td>{s.lost}</td>
                    <td>{s.goals_for}</td>
                    <td>{s.goals_against}</td>
                    <td style={{ color: s.goals_for - s.goals_against >= 0 ? "#10b981" : "#ee1e46" }}>
                      {s.goals_for - s.goals_against >= 0 ? "+" : ""}{s.goals_for - s.goals_against}
                    </td>
                    <td><strong style={{ color: "var(--text)" }}>{s.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfTomorrow() {
  const d = startOfToday()
  d.setDate(d.getDate() + 1)
  return d
}

function groupMatchesByRound(matches) {
  const order = []
  const map = new Map()
  for (const m of matches) {
    const key = m.round || "—"
    if (!map.has(key)) {
      map.set(key, [])
      order.push(key)
    }
    map.get(key).push(m)
  }
  return order.map(key => ({ key, items: map.get(key) }))
}

export default function LeagueDetailPage() {
  const { t, i18n } = useTranslation()
  const { code } = useParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const [competition, setCompetition] = useState(null)
  const [matches, setMatches]         = useState([])
  const [standings, setStandings]     = useState([])
  const [tab, setTab]                 = useState("today")
  const [loading, setLoading]         = useState(true)
  const [tabLoading, setTabLoading]   = useState(false)

  const favKey = competition?.code ?? code

  const tabParam = tab === "standings" ? null : tab

  const hasUpcoming = (ms) => ms.some(m => m.status === "scheduled" && new Date(m.kickoff_at) >= startOfTomorrow())
  const hasResults  = (ms) => ms.some(m => m.status === "finished")

  const loadMatches = useCallback(() => {
    if (!code || tab === "standings") return Promise.resolve()
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const url = `/api/v1/competitions/${code}/fixtures?tab=${tabParam || "today"}&tz=${encodeURIComponent(tz)}`
    return fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(data => setMatches(Array.isArray(data) ? data : []))
      .catch(() => setMatches([]))
  }, [code, tab, tabParam])

  useEffect(() => {
    setLoading(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    Promise.all([
      fetch(`/api/v1/competitions/${code}`).then(r => r.json()),
      fetch(`/api/v1/competitions/${code}/fixtures?tab=today&tz=${encodeURIComponent(tz)}`).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/standings?competition=${code}`).then(r => r.json()).catch(() => []),
    ]).then(([comp, matchData, standData]) => {
      setCompetition(comp)
      const ms = Array.isArray(matchData) ? matchData : []
      setMatches(ms)
      const flat = flattenStandings(standData)
      setStandings(flat)
      const now = startOfToday()
      const tmrw = startOfTomorrow()
      const hasLiveOrToday = ms.some(m => m.status === "live" || (new Date(m.kickoff_at) >= now && new Date(m.kickoff_at) < tmrw))
      if (!hasLiveOrToday && hasResults(ms)) setTab("results")
      else if (!hasLiveOrToday && hasUpcoming(ms)) setTab("fixtures")
    }).finally(() => setLoading(false))
  }, [code])

  useEffect(() => {
    if (loading || tab === "standings") return
    setTabLoading(true)
    loadMatches().finally(() => setTabLoading(false))
  }, [tab, loadMatches, loading])

  const applyLiveScore = useCallback((d) => {
    setMatches(prev => {
      let touched = false
      const next = prev.map(m => {
        const hit = d.external_id != null && m.external_id === d.external_id
        if (!hit) return m
        if (m.home_score === d.home_score && m.away_score === d.away_score && m.status === d.status) return m
        touched = true
        return { ...m, home_score: d.home_score, away_score: d.away_score, status: d.status, minute: d.minute }
      })
      return touched ? next : prev
    })
  }, [])
  useLiveScoresChannel(applyLiveScore)

  usePageMeta(
    competition
      ? t("leagues.metaTitleComp", { name: translateLeague(competition.name, i18n.language) ?? competition.name })
      : null,
    competition
      ? t("leagues.metaDescComp", {
          name: translateLeague(competition.name, i18n.language) ?? competition.name,
          country: competition.country ? ` — ${translateCountry(competition.country, i18n.language) ?? competition.country}` : "",
        })
      : null
  )

  const today = startOfToday()
  const tomorrow = startOfTomorrow()

  const todayMatches = matches.filter(m => {
    const d = new Date(m.kickoff_at)
    return d >= today && d < tomorrow
  })
  const liveMatches  = matches.filter(m => m.status === "live")

  const TABS = [
    { key: "today",      label: t("time.today") },
    { key: "fixtures",   label: t("nav.fixtures") },
    { key: "results",    label: t("nav.results") },
    ...(standings.length > 0 ? [{ key: "standings", label: t("nav.standings", "Standings") }] : []),
  ]

  const displayedMatches =
    tab === "today"    ? [...liveMatches, ...todayMatches.filter(m => m.status !== "live")] :
    tab === "standings" ? [] :
    matches

  if (loading) {
    return (
      <div>
        <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
          <div className="container"><h1 className="page-hero__title">{t("loading")}</h1></div>
        </div>
        <div className="site-section container">
          <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
        <div className="container">
          <div className="d-flex align-items-center" style={{ gap: 16 }}>
            {competition?.logo && (
              <img
                src={competition.logo}
                alt={competition.name}
                className="logo-lg" style={{ margin: "0 auto 12px" }}
                onError={e => (e.target.style.display = "none")}
              />
            )}
            <div style={{ flex: 1 }}>
              <h1 className="page-hero__title" style={{ marginBottom: 4 }}>
                {translateLeague(competition?.name, i18n.language) ?? competition?.name}
              </h1>
              <p className="page-hero__sub" style={{ margin: 0 }}>
                {translateCountry(competition?.country, i18n.language) ?? competition?.country}
              </p>
            </div>
            {competition && (
              <button
                onClick={() => toggleFavorite({ type: "competition", id: favKey, name: competition.name, code: favKey, flag_url: competition.logo })}
                title={isFavorite("competition", favKey) ? t("team.unfollowLeague") : t("team.followLeague")}
                style={{
                  background: isFavorite("competition", favKey) ? "rgba(238,30,70,.15)" : "var(--surface2)",
                  border: isFavorite("competition", favKey) ? "1px solid rgba(238,30,70,.4)" : "1px solid var(--border)",
                  borderRadius: 20, padding: "6px 16px",
                  color: isFavorite("competition", favKey) ? "#ee1e46" : "var(--muted)",
                  fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
                }}
              >
                {isFavorite("competition", favKey) ? t("team.following") : t("team.follow")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner">
            {TABS.map(tabItem => (
              <button
                key={tabItem.key}
                className={`tab-link${tab === tabItem.key ? " tab-link--active" : ""}`}
                onClick={() => setTab(tabItem.key)}
              >
                {tabItem.label}
                {tabItem.key === "today" && liveMatches.length > 0 && (
                  <span className="live-dot" style={{ marginLeft: 6 }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {tab === "standings" ? (
            <StandingsTable standings={standings} t={t} i18n={i18n} leagueCode={code} />
          ) : tabLoading ? (
            <div className="loading-shimmer" style={{ height: 240, borderRadius: 12 }} />
          ) : displayedMatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3>{t("noMatches")}</h3>
              <p>
                {tab === "today"    ? t("time.noMatches", { date: t("time.today").toLowerCase() }) :
                 tab === "fixtures" ? t("home.noUpcoming") :
                 t("scores.noResults")}
              </p>
            </div>
          ) : (
            <div className="match-list">
              {(tab === "fixtures" || tab === "results") && displayedMatches.some(m => m.round)
                ? groupMatchesByRound(displayedMatches).map(({ key, items }) => (
                    <div key={key} className="mb-4">
                      <div className="fixture-day__header">{key}</div>
                      {items.map(m => (
                        <MatchRow
                          key={m.id}
                          match={m}
                          showDate
                          showMeta={false}
                          onClick={navIdFor(m) ? () => navigateToMatch(navigate, m) : undefined}
                        />
                      ))}
                    </div>
                  ))
                : displayedMatches.map(m => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      showDate={tab !== "today"}
                      onClick={navIdFor(m) ? () => navigateToMatch(navigate, m) : undefined}
                    />
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
