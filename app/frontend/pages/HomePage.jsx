import { useNavigate } from "react-router-dom"
import { useMatches } from "../hooks/useMatches"
import Hero from "../components/Hero"
import MatchCard from "../components/MatchCard"

// Template news posts using local images
const NEWS_POSTS = [
  {
    img: "/images/img_1.jpg",
    title: "Mexico opens World Cup 2026 at the legendary Estadio Azteca",
    author: "Golazo Staff",
    date: "Jun 11, 2026 • Sports"
  },
  {
    img: "/images/img_3.jpg",
    title: "48 teams, 12 groups — the new World Cup format explained",
    author: "Golazo Staff",
    date: "Jun 3, 2026 • Preview"
  },
  {
    img: "/images/img_2.jpg",
    title: "Argentina arrive as defending champions — can Messi do it again?",
    author: "Golazo Staff",
    date: "Jun 2, 2026 • Teams"
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { matches: liveMatches }     = useMatches("live",     { competition: "WC" })
  const { matches: upcomingMatches } = useMatches("upcoming", { competition: "WC" })
  const nextMatch = upcomingMatches[0]

  return (
    <>
      {/* Hero — exact template structure */}
      <Hero nextMatch={nextMatch} />

      {/* Featured match — .d-flex.team-vs (template style) */}
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            {liveMatches.length > 0 ? (
              liveMatches.slice(0, 1).map(m => (
                <MatchCard key={m.id} match={m} onClick={() => navigate("/scores/live")} />
              ))
            ) : upcomingMatches.length > 0 ? (
              <MatchCard match={upcomingMatches[0]} onClick={() => navigate("/scores/fixtures")} />
            ) : null}
          </div>
        </div>
      </div>

      {/* Latest News — exact template .latest-news structure */}
      <div className="latest-news">
        <div className="container">
          <div className="row">
            <div className="col-12 title-section">
              <h2 className="heading">Latest News</h2>
            </div>
          </div>
          <div className="row no-gutters">
            {NEWS_POSTS.map((post, i) => (
              <div key={i} className="col-md-4">
                <div className="post-entry">
                  <a href="#" onClick={e => { e.preventDefault(); navigate("/news") }}>
                    <img src={post.img} alt={post.title} className="img-fluid" />
                  </a>
                  <div className="caption">
                    <div className="caption-inner">
                      <h3 className="mb-3">{post.title}</h3>
                      <div className="author d-flex align-items-center">
                        <div className="img mb-2 mr-3">
                          <img src="/images/person_1.jpg" alt="" />
                        </div>
                        <div className="text">
                          <h4>{post.author}</h4>
                          <span>{post.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                    <h3>Next Match</h3>
                  </div>
                  <div className="widget-body mb-3">
                    <div className="widget-vs">
                      <div className="d-flex align-items-center justify-content-around justify-content-between w-100">
                        <div className="team-1 text-center">
                          {nextMatch.home_team?.flag_url
                            ? <img src={nextMatch.home_team.flag_url} alt="" style={{ maxWidth: 80, borderRadius: 4 }} />
                            : <span style={{ fontSize: "3rem" }}>🏳️</span>
                          }
                          <h3>{nextMatch.home_team?.name}</h3>
                        </div>
                        <div>
                          <span className="vs"><span>VS</span></span>
                        </div>
                        <div className="team-2 text-center">
                          {nextMatch.away_team?.flag_url
                            ? <img src={nextMatch.away_team.flag_url} alt="" style={{ maxWidth: 80, borderRadius: 4 }} />
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
                  <h3>Upcoming Matches</h3>
                </div>
                <table className="table custom-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Home</th>
                      <th></th>
                      <th>Away</th>
                      <th>Group</th>
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
                            {m.home_team?.flag_url && <img src={m.home_team.flag_url} alt="" style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2 }} />}
                            <strong className="text-white">{m.home_team?.code}</strong>
                          </div>
                        </td>
                        <td style={{ color: "gray", fontSize: "0.75rem" }}>vs</td>
                        <td>
                          <div className="d-flex align-items-center" style={{ gap: 6 }}>
                            {m.away_team?.flag_url && <img src={m.away_team.flag_url} alt="" style={{ width: 20, height: 14, objectFit: "cover", borderRadius: 2 }} />}
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
