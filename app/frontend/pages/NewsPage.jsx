// News aggregated from public football RSS feeds via backend proxy
const NEWS = [
  {
    title: "FIFA World Cup 2026: Everything you need to know",
    source: "FIFA.com",
    date: "Jun 1, 2026",
    summary: "The 23rd FIFA World Cup kicks off June 11 with Mexico vs South Africa at Estadio Azteca. 48 teams compete across 16 venues in USA, Canada, and Mexico.",
    tag: "Preview",
    url: "#"
  },
  {
    title: "Group A preview: Mexico, South Korea, Czech Republic, South Africa",
    source: "ESPN FC",
    date: "Jun 2, 2026",
    summary: "El Tri opens the tournament on home soil at the iconic Azteca. South Korea's K-League stars could cause an upset. Full group analysis.",
    tag: "Group Stage",
    url: "#"
  },
  {
    title: "Lionel Messi leads Argentina into World Cup as defending champions",
    source: "Goal.com",
    date: "Jun 2, 2026",
    summary: "Argentina arrive in North America looking to defend the title they won so dramatically in Qatar 2022. Can Messi lift the trophy once more?",
    tag: "Teams",
    url: "#"
  },
  {
    title: "Expanded World Cup: 48 teams, 12 groups, new format explained",
    source: "BBC Sport",
    date: "May 30, 2026",
    summary: "For the first time, 48 nations compete at a World Cup. The format includes 12 groups of 4 teams, with the top 2 plus 8 best third-placed teams advancing.",
    tag: "Format",
    url: "#"
  },
  {
    title: "Estadio Azteca set to host historic World Cup opener for third time",
    source: "The Guardian",
    date: "May 29, 2026",
    summary: "Mexico City's legendary stadium becomes the first venue to host World Cup matches in three different editions: 1970, 1986, and now 2026.",
    tag: "Venues",
    url: "#"
  },
  {
    title: "Mbappé leads France's quest for back-to-back World Cup titles",
    source: "L'Équipe",
    date: "Jun 1, 2026",
    summary: "Les Bleus, runners-up in Qatar, arrive with Kylian Mbappé at his peak. France face Uruguay and Algeria in a tough Group G.",
    tag: "Teams",
    url: "#"
  },
]

const TAG_COLORS = {
  "Preview":     "#6366f1",
  "Group Stage": "#ee1e46",
  "Teams":       "#10b981",
  "Format":      "#f59e0b",
  "Venues":      "#8b5cf6",
}

export default function NewsPage() {
  return (
    <>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_1.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">News</h1>
          <p className="page-hero__sub">Latest from FIFA World Cup 2026</p>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          <div className="row">
            {NEWS.map((article, i) => (
              <div key={i} className={`col-lg-${i === 0 ? "12" : "6"} mb-4`}>
                <div className={`news-card${i === 0 ? " news-card--featured" : ""}`}>
                  <div className="news-card__tag" style={{ background: TAG_COLORS[article.tag] || "#ee1e46" }}>
                    {article.tag}
                  </div>
                  <h3 className="news-card__title">{article.title}</h3>
                  <p className="news-card__summary">{article.summary}</p>
                  <div className="news-card__footer">
                    <span className="news-card__source">{article.source}</span>
                    <span className="news-card__date">{article.date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
