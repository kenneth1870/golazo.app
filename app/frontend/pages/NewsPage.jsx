import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"

const SOURCE_COLORS = {
  "BBC Sport": "#b80000",
  "ESPN FC":   "#cc0000",
  "Goal.com":  "#ee1e46",
}

function NewsCard({ article, featured }) {
  const color = SOURCE_COLORS[article.source] || "#ee1e46"

  return (
    <Link
      to={`/news/${article.id}`}
      className={`news-card${featured ? " news-card--featured" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {article.image
        ? <div className="news-card__img" style={{ backgroundImage: `url(${article.image})` }} />
        : <div className="news-card__img" style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e)" }} />
      }
      <div className="news-card__body">
        <div className="news-card__tag" style={{ background: color }}>{article.source}</div>
        <h3 className="news-card__title">{article.title}</h3>
        {article.summary && <p className="news-card__summary">{article.summary}</p>}
        <div className="news-card__footer">
          <span className="news-card__source">{article.source}</span>
          <span className="news-card__date">{article.date_label}</span>
        </div>
      </div>
    </Link>
  )
}

export default function NewsPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("news.title"), "Latest football news — World Cup 2026, transfers, match previews and results.")
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [source, setSource]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setSource(null)
    fetch(`/api/v1/news?lang=${i18n.language}`)
      .then(r => r.json())
      .then(setArticles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [i18n.language])

  const allLabel = t("news.all")
  const sources  = [allLabel, ...new Set(articles.map(a => a.source))]
  const active   = source ?? allLabel
  const filtered = active === allLabel ? articles : articles.filter(a => a.source === active)

  return (
    <>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_1.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("news.title")}</h1>
          <p className="page-hero__sub">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner" style={{ overflowX: "auto" }}>
            {sources.map(s => (
              <button
                key={s}
                className={`tab-link${active === s ? " tab-link--active" : ""}`}
                onClick={() => setSource(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="site-section">
        <div className="container">
          {loading ? (
            <div className="row">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="col-lg-6 mb-4">
                  <div className="loading-shimmer" style={{ height: 220, borderRadius: 12 }} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📰</div>
              <h3>{t("news.noArticles")}</h3>
            </div>
          ) : (
            <div className="row">
              {filtered.map((article, i) => (
                <div key={i} className={`col-lg-${i === 0 && active === allLabel ? "12" : "6"} mb-4`}>
                  <NewsCard article={article} featured={i === 0 && active === allLabel} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
