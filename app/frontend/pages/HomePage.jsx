import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useMatches } from "../hooks/useMatches"
import { useFavoriteTeam } from "../hooks/useFavoriteTeam"
import { useLiveCount } from "../contexts/LiveContext"
import Hero from "../components/Hero"
import MatchCard from "../components/MatchCard"
import FavoriteTeamPicker from "../components/FavoriteTeamPicker"

const FALLBACK_IMGS = ["/images/img_1.jpg", "/images/img_3.jpg", "/images/img_2.jpg"]

function useLatestNews() {
  const { i18n } = useTranslation()
  const [news, setNews] = useState([])
  useEffect(() => {
    fetch(`/api/v1/news?lang=${i18n.language}`)
      .then(r => r.json())
      .then(data => setNews(data.slice(0, 3)))
      .catch(() => {})
  }, [i18n.language])
  return news
}

function FavoriteTeamCard({ fav, todayMatches, upcomingMatches, navigate, t }) {
  if (!fav) return null

  const favMatches = [...todayMatches, ...upcomingMatches].filter(m =>
    m.home_team?.name === fav.name || m.away_team?.name === fav.name
  )
  const next = favMatches[0]

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(238,30,70,.12) 0%, rgba(238,30,70,.04) 100%)",
      border: "1px solid rgba(238,30,70,.25)", borderRadius: 12,
      padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {fav.flag_url && <img src={fav.flag_url} alt="" className="logo-sm" onError={e => (e.target.style.display="none")} />}
        <div>
          <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>{t("home.yourTeam")}</div>
          <div style={{ fontWeight: 800, color: "#fff", fontSize: "1rem" }}>{fav.name}</div>
          {fav.group && <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{t("nav.group", { letter: fav.group })}</div>}
        </div>
      </div>
      {next ? (
        <div
          style={{ marginLeft: "auto", cursor: "pointer", textAlign: "right" }}
          onClick={() => next.external_id ? navigate(`/matches/${next.external_id}`) : navigate("/scores/fixtures")}
        >
          <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            {next.status === "live" ? t("home.playingNow") : t("hero.nextMatch")}
          </div>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.9rem" }}>
            {next.home_team?.name} vs {next.away_team?.name}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#ee1e46" }}>
            {next.status === "live"
              ? `LIVE ${next.minute ? `${next.minute}'` : ""}`
              : next.kickoff_at
              ? new Date(next.kickoff_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
              : "TBD"}
          </div>
        </div>
      ) : (
        <div style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--muted)" }}>{t("home.noUpcoming")}</div>
      )}
    </div>
  )
}

export default function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { matches: liveWC }         = useMatches("live",     { competition: "WC" })
  const { matches: upcomingMatches } = useMatches("upcoming", { competition: "WC" })
  const latestNews = useLatestNews()
  const [fav]  = useFavoriteTeam()
  const liveCount  = useLiveCount()
  // Show the live WC match in Hero if one is active, otherwise next upcoming
  const nextMatch  = liveWC[0] || upcomingMatches[0]

  return (
    <>
      {/* Hero — exact template structure */}
      <Hero nextMatch={nextMatch} />

      {/* Live now bar */}
      {liveCount > 0 && (
        <div
          style={{ background: "#ee1e46", padding: "10px 0", cursor: "pointer" }}
          onClick={() => navigate("/scores/today")}
        >
          <div className="container d-flex align-items-center" style={{ gap: 10 }}>
            <span className="live-dot" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
              {t("home.liveNow", { count: liveCount })}
            </span>
            <span style={{ color: "rgba(255,255,255,.7)", fontSize: "0.75rem", marginLeft: "auto" }}>
              {t("home.viewAll")}
            </span>
          </div>
        </div>
      )}

      {/* Favorite team card + picker */}
      <div className="container" style={{ paddingTop: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: fav ? 0 : 8 }}>
          <FavoriteTeamCard fav={fav} todayMatches={[]} upcomingMatches={upcomingMatches} navigate={navigate} t={t} />
          <FavoriteTeamPicker />
        </div>
      </div>

      {/* Featured WC match */}
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            {liveWC.length > 0 ? (
              liveWC.slice(0, 1).map(m => (
                <MatchCard key={m.id} match={m}
                  onClick={() => m.external_id ? navigate(`/matches/${m.external_id}`) : navigate(`/matches/db-${m.id}`)} />
              ))
            ) : upcomingMatches.length > 0 ? (
              <MatchCard match={upcomingMatches[0]}
                onClick={() => {
                  const m = upcomingMatches[0]
                  m.external_id ? navigate(`/matches/${m.external_id}`) : navigate(`/matches/db-${m.id}`)
                }} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Latest News — exact template .latest-news structure */}
      <div className="latest-news">
        <div className="container">
          <div className="row">
            <div className="col-12 title-section">
              <h2 className="heading">{t("home.latestNews")}</h2>
            </div>
          </div>
          <div className="row no-gutters">
            {(latestNews.length > 0 ? latestNews : [null, null, null]).map((post, i) => (
              <div key={i} className="col-md-4">
                <Link to={post?.id ? `/news/${post.id}` : "/news"} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                  <div className="post-entry">
                    <img
                      src={post?.image || FALLBACK_IMGS[i]}
                      alt={post?.title || ""}
                      className="img-fluid"
                      onError={e => { e.target.src = FALLBACK_IMGS[i % FALLBACK_IMGS.length] }}
                    />
                    <div className="caption">
                      <div className="caption-inner">
                        {post ? (
                          <>
                            <h3 className="mb-3">{post.title}</h3>
                            <div className="author d-flex align-items-center">
                              <div className="img mb-2 mr-3">
                                <img src="/images/person_1.jpg" alt="" />
                              </div>
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
            ))}
          </div>
        </div>
      </div>

      {/* Next Match + Standings — exact template .site-section.bg-dark */}
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
                          <h3>{nextMatch.home_team?.name}</h3>
                        </div>
                        <div>
                          <span className="vs"><span>VS</span></span>
                        </div>
                        <div className="team-2 text-center">
                          {nextMatch.away_team?.flag_url
                            ? <img src={nextMatch.away_team.flag_url} alt="" className="logo-md" style={{ margin: "0 auto" }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{nextMatch.away_team?.name}</h3>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-center widget-vs-contents mb-4">
                    <h4>{nextMatch.round || nextMatch.group_stage}</h4>
                    <p className="mb-5">
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleString([], { month: "long", day: "numeric", year: "numeric" })
                          : "TBD"}
                      </span>
                      <span className="d-block">
                        {nextMatch.kickoff_at
                          ? new Date(nextMatch.kickoff_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })
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
                    {upcomingMatches.slice(0, 8).map(m => (
                      <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => navigate("/scores/fixtures")}>
                        <td style={{ fontSize: "0.75rem", color: "gray" }}>
                          {m.kickoff_at ? new Date(m.kickoff_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "TBD"}
                        </td>
                        <td>
                          <div className="d-flex align-items-center" style={{ gap: 6 }}>
                            {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt="" className="flag-xs" />}
                            <strong className="text-white">{m.home_team?.code}</strong>
                          </div>
                        </td>
                        <td style={{ color: "gray", fontSize: "0.75rem" }}>vs</td>
                        <td>
                          <div className="d-flex align-items-center" style={{ gap: 6 }}>
                            {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt="" className="flag-xs" />}
                            <strong className="text-white">{m.away_team?.code}</strong>
                          </div>
                        </td>
                        <td style={{ color: "gray", fontSize: "0.75rem" }}>{m.group_stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
