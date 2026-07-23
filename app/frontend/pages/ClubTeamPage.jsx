import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam, resolveTeamLogo } from "../i18n/teamNames"
import { translateLeague, translateCountry } from "../i18n/leagueNames"
import MatchRow from "../components/MatchRow"
import { useFavorites } from "../hooks/useFavorites"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { syncTeamFollowToPush } from "../utils/favoritePush"
import { usePageMeta } from "../hooks/usePageMeta"
import { navigateToMatch, navIdFor } from "../utils/matchDetailCache"
import { useLiveScoresChannel } from "../hooks/useLiveScoresChannel"
import { leagueHeroStyle } from "../utils/leagueHeroImages"

export default function ClubTeamPage() {
  const { t, i18n } = useTranslation()
  const { code, slug } = useParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addTeams, subscribed } = usePushNotifications()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("upcoming")
  const heroKey = `${code}|${slug}`
  const heroRef = useRef({ key: null, style: null })
  if (heroRef.current.key !== heroKey) {
    heroRef.current = { key: heroKey, style: leagueHeroStyle(code, slug) }
  }
  const heroStyle = heroRef.current.style

  const team = data?.team
  const displayName = team ? (translateTeam(team.name, i18n.language) ?? team.name) : null

  usePageMeta(
    displayName,
    displayName ? t("meta.teamDescClubs", { name: displayName }) : null,
    { image: resolveTeamLogo(team?.name, team?.flag_url) || undefined }
  )

  useEffect(() => {
    if (!code || !slug) return
    setLoading(true)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch(`/api/v1/club_teams/${code}/${slug}?tz=${encodeURIComponent(tz)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [code, slug])

  const applyLiveScore = useCallback((d) => {
    setData(prev => {
      if (!prev) return prev
      const patch = ms => ms.map(m => {
        if (m.external_id !== d.external_id) return m
        if (m.home_score === d.home_score && m.away_score === d.away_score && m.status === d.status) return m
        return { ...m, home_score: d.home_score, away_score: d.away_score, status: d.status, minute: d.minute }
      })
      return { ...prev, upcoming: patch(prev.upcoming || []), recent: patch(prev.recent || []) }
    })
  }, [])
  useLiveScoresChannel(applyLiveScore)

  if (loading) {
    return (
      <div>
        <div className="page-hero" style={heroStyle}>
          <div className="container"><h1 className="page-hero__title">{t("loading")}</h1></div>
        </div>
        <div className="site-section container">
          <div className="loading-shimmer" style={{ height: 320, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (!data?.team) {
    return (
      <div className="site-section container">
        <div className="empty-state">
          <div className="empty-state__icon">⚽</div>
          <h3>{t("error.notFound", "Not found")}</h3>
          <Link to={`/leagues/${code}`} className="btn btn-primary btn-sm">{t("nav.leagues")}</Link>
        </div>
      </div>
    )
  }

  const standing = data.standing
  const competition = data.competition
  const favId = team.name
  const following = isFavorite("team", favId)
  const matches = tab === "upcoming" ? (data.upcoming || []) : (data.recent || [])

  function handleFollowToggle() {
    const willFollow = !following
    toggleFavorite({
      type: "team",
      id: favId,
      name: team.name,
      flag_url: team.flag_url,
      league_code: code,
    })
    syncTeamFollowToPush(team.name, { addTeams, subscribed, following: willFollow })
  }

  return (
    <div>
      <div className="page-hero" style={heroStyle}>
        <div className="container">
          <div className="d-flex align-items-center" style={{ gap: 16, flexWrap: "wrap" }}>
            {team.flag_url && (
              <img
                src={resolveTeamLogo(team.name, team.flag_url)}
                alt={displayName}
                className="logo-lg"
                onError={e => (e.target.style.display = "none")}
              />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 4 }}>
                <Link to={`/leagues/${code}`} style={{ color: "var(--muted)", textDecoration: "none" }}>
                  {translateLeague(competition?.name, i18n.language) ?? competition?.name ?? code}
                </Link>
                {competition?.country && (
                  <span> · {translateCountry(competition.country, i18n.language) ?? competition.country}</span>
                )}
              </div>
              <h1 className="page-hero__title" style={{ marginBottom: 4 }}>{displayName}</h1>
              {standing && (
                <p className="page-hero__sub" style={{ margin: 0 }}>
                  #{standing.rank} · {standing.points} {t("table.points").toLowerCase()} · {standing.played} {t("table.played").toLowerCase()}
                </p>
              )}
            </div>
            <button
              onClick={handleFollowToggle}
              style={{
                background: following ? "rgba(238,30,70,.15)" : "var(--surface2)",
                border: following ? "1px solid rgba(238,30,70,.4)" : "1px solid var(--border)",
                borderRadius: 20, padding: "6px 16px",
                color: following ? "var(--accent)" : "var(--muted)",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", flexShrink: 0,
              }}
            >
              {following ? t("team.following") : t("team.follow")}
            </button>
            <Link
              to={`/compare/teams?home=${code}/${slug}`}
              style={{
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 20, padding: "6px 16px", color: "var(--text)",
                fontSize: "0.78rem", fontWeight: 700, textDecoration: "none", flexShrink: 0,
              }}
            >
              ⚔️ {t("teamComparison.compare")}
            </Link>
          </div>
        </div>
      </div>

      {standing && (
        <div className="site-section" style={{ paddingBottom: 0 }}>
          <div className="container">
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))",
              gap: 8, padding: "14px 16px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 12,
            }}>
              {[
                [t("table.pos"), standing.rank],
                [t("table.played"), standing.played],
                [t("table.won"), standing.won],
                [t("table.drawn"), standing.drawn],
                [t("table.lost"), standing.lost],
                [t("table.gd"), standing.goal_diff >= 0 ? `+${standing.goal_diff}` : standing.goal_diff],
                [t("table.points"), standing.points],
              ].map(([label, value]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "1.05rem" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner tab-bar__inner--scroll">
            <button
              className={`tab-link${tab === "upcoming" ? " tab-link--active" : ""}`}
              onClick={() => setTab("upcoming")}
            >
              {t("nav.fixtures")}
            </button>
            <button
              className={`tab-link${tab === "recent" ? " tab-link--active" : ""}`}
              onClick={() => setTab("recent")}
            >
              {t("nav.results")}
            </button>
          </div>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {matches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📅</div>
              <h3>{tab === "upcoming" ? t("home.noUpcoming") : t("scores.noResults")}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
                <Link to={`/leagues/${code}`} className="btn btn-primary btn-sm">{t("nav.standings")}</Link>
                {!following && (
                  <button className="btn btn-outline-light btn-sm" onClick={handleFollowToggle}>
                    {t("team.follow")} {displayName}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="match-list">
              {matches.map(m => (
                <MatchRow
                  key={m.id || m.external_id}
                  match={m}
                  showDate
                  showMeta={false}
                  onClick={navIdFor(m) ? () => navigateToMatch(navigate, m) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
