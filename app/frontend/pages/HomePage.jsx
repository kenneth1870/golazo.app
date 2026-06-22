import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches, patchLiveScore } from "../hooks/useMatches"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"
import { useLiveCount } from "../contexts/LiveContext"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { formatKickoff } from "../hooks/useLocalTime"
import { translateTeam } from "../i18n/teamNames"
import Hero from "../components/Hero"
import MatchCard from "../components/MatchCard"
import MatchRow from "../components/MatchRow"
import FavoriteTeamPicker from "../components/FavoriteTeamPicker"
import { useStandingsChannel } from "../hooks/useStandingsChannel"
import { useLiveScoresChannel } from "../hooks/useLiveScoresChannel"

function useTodayWC() {
  const [matches, setMatches] = useState([])
  const loadRef = useRef(null)

  const load = useCallback(() => {
    if (document.hidden) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    fetch(`/api/v1/today?tz=${encodeURIComponent(tz)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(all => {
        const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: tz })
        setMatches(
          all.filter(m => {
            if (m.competition?.code !== "WC") return false
            const ko = m.kickoff_at || m.kickoff
            if (!ko) return false
            return new Date(ko).toLocaleDateString("en-CA", { timeZone: tz }) === todayStr
          })
        )
      })
      .catch(() => { /* silently retain previous matches on network hiccup */ })
  }, [])

  loadRef.current = load

  useEffect(() => {
    load()
    const onVisible = () => { if (!document.hidden) loadRef.current?.() }
    document.addEventListener("visibilitychange", onVisible)
    // Safety-net poll only — live changes arrive via the live_scores WebSocket.
    const iv = setInterval(() => loadRef.current?.(), 300_000)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load])

  // Patch a row in-place from a live_scores push — no re-fetch.
  const applyLiveScore = useCallback((d) => {
    setMatches(prev => {
      let touched = false
      const next = prev.map(m => {
        const hit = (d.external_id != null && m.external_id === d.external_id) ||
                    (d.match_id != null && m.id === d.match_id)
        if (!hit) return m
        if (m.home_score === d.home_score && m.away_score === d.away_score && m.status === d.status) return m
        touched = true
        return { ...m, home_score: d.home_score, away_score: d.away_score, status: d.status, minute: d.minute }
      })
      return touched ? next : prev
    })
  }, [])
  useLiveScoresChannel(applyLiveScore)

  // Instant refresh when a WC match finishes (final scores + status settle)
  useStandingsChannel(load)

  return matches
}

function useLatestNews() {
  const { i18n } = useTranslation()
  const [news, setNews]   = useState([])
  const [error, setError] = useState(false)

  const load = () => {
    setError(false)
    fetch(`/api/v1/news?lang=${i18n.language}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => setNews(data.slice(0, 3)))
      .catch(() => setError(true))
  }

  useEffect(() => { load() }, [i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps
  return { news, newsError: error, retryNews: load }
}

// ─── Favorite team card ───────────────────────────────────────────────────────
function FavoriteTeamCard({ fav, upcomingMatches, navigate, t }) {
  const { i18n } = useTranslation()
  const favMatches = upcomingMatches.filter(m =>
    m.home_team?.name === fav.name || m.away_team?.name === fav.name
  )
  const next = favMatches[0]

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(238,30,70,.12) 0%, rgba(238,30,70,.04) 100%)",
      border: "1px solid rgba(238,30,70,.25)", borderRadius: 12,
      padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {fav.flag_url && <img src={fav.flag_url} alt="" className="logo-sm" onError={e => (e.target.style.display="none")} />}
        <div>
          <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("home.yourTeam")}</div>
          <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "1rem" }}>{fav.name}</div>
          {fav.group && <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{t("nav.group", { letter: fav.group })}</div>}
        </div>
      </div>
      {next ? (
        <div
          style={{ marginLeft: "auto", cursor: "pointer", textAlign: "right" }}
          onClick={() => navigate(next.external_id ? `/matches/${next.external_id}` : `/matches/db-${next.id}`)}
        >
          <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {next.status === "live" ? t("home.playingNow") : t("hero.nextMatch")}
          </div>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.9rem" }}>
            {translateTeam(next.home_team?.name, i18n.language)} vs {translateTeam(next.away_team?.name, i18n.language)}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#ee1e46" }}>
            {next.status === "live"
              ? `LIVE ${next.minute ? `${next.minute}'` : ""}`
              : next.kickoff_at
              ? new Date(next.kickoff_at).toLocaleString(i18n.language || undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "TBD"}
          </div>
        </div>
      ) : (
        <div style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--muted)" }}>{t("home.noUpcoming")}</div>
      )}
    </div>
  )
}

// ─── Today's matches strip ────────────────────────────────────────────────────
function TodayMatchesSection({ todayMatches, navigate, t }) {
  // todayMatches comes from /api/v1/today filtered to WC — same source as scores/today page.
  // Already deduplicated and timezone-correct; just sort and slice.
  const all     = [...(todayMatches || [])]
    .sort((a, b) => new Date(a.kickoff_at || a.kickoff) - new Date(b.kickoff_at || b.kickoff))
  const liveCount = all.filter(m => m.status === "live").length
  const visible = all.slice(0, 6)
  if (visible.length === 0) return null

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {liveCount > 0
            ? <><span className="live-dot" /><span style={{ fontWeight: 800, fontSize: ".78rem", color: "var(--text)" }}>LIVE</span></>
            : <span style={{ fontWeight: 800, fontSize: ".78rem", color: "var(--text)", textTransform: "uppercase", letterSpacing: ".06em" }}>{t("time.today", "Today")}</span>
          }
          <span style={{ fontSize: ".7rem", color: "var(--muted)" }}>
            · {t("scores.wcSubtitle", "FIFA World Cup 2026")}
          </span>
        </div>
        <button
          onClick={() => navigate("/scores/today")}
          style={{ background: "none", border: "none", color: "var(--accent)", fontSize: ".72rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
        >
          {t("home.viewAll")}
        </button>
      </div>

      {/* Match rows */}
      <div style={{ background: "var(--surface)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
        {visible.map((m, i) => (
          <div key={m.id} style={{ borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none" }}>
            <MatchRow
              match={m}
              showDate={false}
              onClick={() => navigate(`/matches/${m.external_id ?? m.id}`)}
            />
          </div>
        ))}
      </div>

      {all.length > 6 && (
        <button
          onClick={() => navigate("/scores/today")}
          style={{ width: "100%", marginTop: 8, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, padding: "9px", fontSize: ".72rem", fontWeight: 700, cursor: "pointer" }}
        >
          {t("home.moreMatches", { count: all.length - 6 })}
        </button>
      )}
    </div>
  )
}

// ─── News card (no fallback arcade images) ────────────────────────────────────
function NewsCard({ post, index }) {
  const placeholderColors = ["#1a1f2e", "#1a1420", "#0f1a1a"]
  const placeholderEmojis = ["⚽", "🏆", "🗞️"]
  const bg = placeholderColors[index % placeholderColors.length]

  return (
    <div className="col-md-4">
      <Link to={post?.id ? `/news/${post.id}` : "#"} style={{ display: "block", textDecoration: "none", color: "inherit", pointerEvents: post ? "auto" : "none" }}>
        <div className="post-entry">
          {post ? (
            post.image ? (
              <img src={post.image} alt={post.title || ""} className="img-fluid" onError={e => { e.target.style.display = "none"; e.target.nextSibling?.style && (e.target.nextSibling.style.display = "flex") }} />
            ) : (
              <div style={{ aspectRatio: "16/9", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", borderRadius: "8px 8px 0 0" }}>
                {placeholderEmojis[index % placeholderEmojis.length]}
              </div>
            )
          ) : (
            <div className="loading-shimmer" style={{ aspectRatio: "16/9", borderRadius: "8px 8px 0 0" }} />
          )}
          <div className="caption">
            <div className="caption-inner">
              {post ? (
                <>
                  <h3 className="mb-3">{post.title}</h3>
                  <div className="author d-flex align-items-center">
                    <div className="text">
                      <h4>{post.source}</h4>
                      <span>{post.date_label}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="loading-shimmer" style={{ height: 60, borderRadius: 8 }} />
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate    = useNavigate()
  const liveCount  = useLiveCount()
  const [fav]      = useFavoriteTeam()

  usePageMeta(
    "Golazo — Live Football Scores, Stats & World Cup 2026",
    "Real-time live scores, lineups, standings, and match insights for the FIFA World Cup 2026 and 100+ competitions worldwide. Free · No sign-up required."
  )
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": "FIFA World Cup 2026",
    "alternateName": "Mundial 2026",
    "description": "The 2026 FIFA World Cup hosted across the United States, Canada and Mexico. Live scores, fixtures, standings and stats.",
    "startDate": "2026-06-11",
    "endDate": "2026-07-19",
    "location": { "@type": "Place", "name": "United States, Canada and Mexico" },
    "organizer": { "@type": "Organization", "name": "FIFA", "url": "https://www.fifa.com" },
    "url": "https://golazo.app/world-cup-2026"
  })

  const { matches: liveWC }         = useMatches("live",     { competition: "WC" })
  const { matches: upcomingMatches } = useMatches("upcoming", { competition: "WC" })
  useLiveScoresChannel(patchLiveScore)
  const todayWC                      = useTodayWC()
  const { news: latestNews, newsError, retryNews } = useLatestNews()

  const todayWCIds = new Set(todayWC.map(m => m.external_id).filter(Boolean))
  const todayStr = new Date().toLocaleDateString("en-CA")
  const upcomingFuture = upcomingMatches.filter(m =>
    !todayWCIds.has(m.external_id) &&
    (!m.kickoff_at || new Date(m.kickoff_at).toLocaleDateString("en-CA") !== todayStr)
  )

  const nextMatch = liveWC.length === 0
    ? upcomingMatches.find(m => !m.kickoff_at || new Date(m.kickoff_at) > new Date())
    : null

  return (
    <>
      {/* ── Hero ── */}
      <Hero nextMatch={nextMatch} liveCount={liveCount} />

      {/* ── Today's matches / Live ── */}
      <div className="container" style={{ paddingTop: 24, paddingBottom: 0 }}>
        <TodayMatchesSection
          todayMatches={todayWC}
          navigate={navigate}
          t={t}
        />
      </div>

      {/* ── Favorite team section ── */}
      <div className="container" style={{ paddingTop: 16, paddingBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
            {fav ? t("home.yourTeam", "Your Team") : t("home.followTeam", "Follow a team")}
          </span>
          <FavoriteTeamPicker />
        </div>
        {fav && (
          <FavoriteTeamCard fav={fav} upcomingMatches={upcomingMatches} navigate={navigate} t={t} />
        )}
      </div>

      {/* ── Latest News ── */}
      <div className="latest-news">
        <div className="container">
          <div className="row">
            <div className="col-12 title-section">
              <h2 className="heading">{t("home.latestNews")}</h2>
              <Link to="/news" style={{ fontSize: ".78rem", color: "var(--accent)", textDecoration: "none", fontWeight: 700 }}>
                {t("home.viewAll")}
              </Link>
            </div>
          </div>
          {newsError && (
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="col-12" style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
                {t("error.newsUnavailable", "Couldn't load news.")}
                <button onClick={retryNews} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.82rem", textDecoration: "underline" }}>
                  {t("error.retry", "Retry")}
                </button>
              </div>
            </div>
          )}
          <div className="row no-gutters">
            {(latestNews.length > 0 ? latestNews : newsError ? [] : [null, null, null]).map((post, i) => (
              <NewsCard key={post?.id ?? i} post={post} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Quick-links section: World Cup + Competitions ── */}
      <div className="site-section" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <div className="container">
          <div className="row" style={{ gap: "0 0" }}>

            {/* World Cup 2026 hub */}
            <div className="col-md-6" style={{ marginBottom: 20 }}>
              <div style={{
                background: "linear-gradient(135deg, rgba(238,30,70,.1) 0%, rgba(238,30,70,.03) 100%)",
                border: "1px solid rgba(238,30,70,.2)", borderRadius: 14, padding: "20px 24px",
              }}>
                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>
                  {t("home.wcSectionTitle")}
                </div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
                  {t("home.wcHosts")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: `📅 ${t("nav.schedule")}`,  path: "/mundial/schedule" },
                    { label: `📊 ${t("nav.groups")}`,    path: "/scores/groups" },
                    { label: `🏆 ${t("nav.knockout")}`,  path: "/scores/knockout" },
                    { label: `⭐ ${t("mundial.tabGoals")}`,   path: "/mundial/scorers" },
                    { label: `🏟️ ${t("nav.venues")}`,   path: "/mundial/venues" },
                    { label: `👥 ${t("nav.teams")}`,     path: "/mundial/teams" },
                  ].map(({ label, path }) => (
                    <Link key={path} to={path} style={{
                      display: "inline-block",
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "6px 12px",
                      fontSize: ".7rem", fontWeight: 700, color: "var(--text)", textDecoration: "none",
                    }}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Club competitions */}
            <div className="col-md-6" style={{ marginBottom: 20 }}>
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 24px",
              }}>
                <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                  {t("home.clubCompetitions")}
                </div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
                  {t("home.liveScoresWorldwide")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League", path: "/leagues/PL" },
                    { label: "🇪🇸 La Liga",         path: "/leagues/LAL" },
                    { label: "🇩🇪 Bundesliga",      path: "/leagues/BL1" },
                    { label: "🇮🇹 Serie A",          path: "/leagues/SA" },
                    { label: "🇫🇷 Ligue 1",          path: "/leagues/L1" },
                    { label: "⭐ Champions League", path: "/leagues/UCL" },
                  ].map(({ label, path }) => (
                    <Link key={path} to={path} style={{
                      display: "inline-block",
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "6px 12px",
                      fontSize: ".7rem", fontWeight: 700, color: "var(--text)", textDecoration: "none",
                    }}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Next match widget + upcoming ── */}
      <div className="site-section bg-dark">
        <div className="container">
          <div className="row">

            {/* Next match widget */}
            <div className="col-lg-6">
              {nextMatch && (
                <div className="widget-next-match">
                  <div className="widget-title">
                    <h3>{t("home.nextMatch")}</h3>
                  </div>
                  <div className="widget-body mb-3">
                    <div className="widget-vs">
                      <div className="d-flex align-items-center justify-content-around justify-content-between w-100">
                        <div className="team-1 text-center">
                          {nextMatch.home_team?.flag_url
                            ? <img src={nextMatch.home_team.flag_url} alt="" className="logo-md" style={{ margin: "0 auto" }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{translateTeam(nextMatch.home_team?.name, i18n.language)}</h3>
                        </div>
                        <div><span className="vs"><span>VS</span></span></div>
                        <div className="team-2 text-center">
                          {nextMatch.away_team?.flag_url
                            ? <img src={nextMatch.away_team.flag_url} alt="" className="logo-md" style={{ margin: "0 auto" }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{translateTeam(nextMatch.away_team?.name, i18n.language)}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center widget-vs-contents mb-4">
                    <h4>{nextMatch.round || nextMatch.group_stage}</h4>
                    <p className="mb-5">
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleString(i18n.language || undefined, { month: "long", day: "numeric", year: "numeric" })
                          : "TBD"}
                      </span>
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleTimeString(i18n.language || undefined, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
                          : ""}
                      </span>
                      <strong className="text-primary">{nextMatch.venue}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Upcoming fixtures */}
            <div className="col-lg-6">
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>{t("home.upcomingMatches")}</h3>
                </div>

                {/* Desktop table */}
                <div className="d-none d-md-block">
                  <table className="table custom-table">
                    <thead>
                      <tr>
                        <th>{t("table.date")}</th>
                        <th>{t("table.home")}</th>
                        <th></th>
                        <th>{t("table.away")}</th>
                        <th>{t("table.group")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingFuture.slice(0, 8).map(m => (
                        <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => navigate("/scores/fixtures")}>
                          <td style={{ fontSize: "0.75rem", color: "gray" }}>
                            {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" }) : "TBD"}
                          </td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 6 }}>
                              {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt="" className="flag-xs" />}
                              <strong style={{ color: "var(--text)" }}>{m.home_team?.code}</strong>
                            </div>
                          </td>
                          <td style={{ color: "gray", fontSize: "0.75rem" }}>vs</td>
                          <td>
                            <div className="d-flex align-items-center" style={{ gap: 6 }}>
                              {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt="" className="flag-xs" />}
                              <strong style={{ color: "var(--text)" }}>{m.away_team?.code}</strong>
                            </div>
                          </td>
                          <td style={{ color: "gray", fontSize: "0.75rem" }}>{m.group_stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile rows */}
                <div className="d-md-none widget-body p-0">
                  {upcomingFuture.slice(0, 6).map(m => (
                    <div key={m.id} className="match-row match-row--clickable" onClick={() => navigate("/scores/fixtures")}>
                      <div className="match-row__status">
                        <span className="match-status-time" style={{ fontSize: "0.65rem" }}>
                          {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" }) : "TBD"}
                        </span>
                      </div>
                      <div className="match-row__teams">
                        <div className="match-row__team match-row__team--home">
                          {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display="none")} />}
                          <span className="team-name">{translateTeam(m.home_team?.name, i18n.language)}</span>
                        </div>
                        <div className="match-row__score">
                          <span className="score-pill score-pill--vs">vs</span>
                        </div>
                        <div className="match-row__team match-row__team--away">
                          <span className="team-name">{translateTeam(m.away_team?.name, i18n.language)}</span>
                          {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display="none")} />}
                        </div>
                      </div>
                      <div className="match-row__meta">
                        {m.group_stage && <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>{m.group_stage}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-3">
                  <Link to="/scores/fixtures" style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
                    {t("home.fullSchedule")}
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
