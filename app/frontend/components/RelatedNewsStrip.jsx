import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchJson } from "../utils/fetchJson"
import { sourceColor } from "../utils/sourceColors"
import { relativeTime } from "../utils/newsQuery"
import { attachNewsPrefetch } from "../utils/newsPrefetch"

function NewsCardInner({ article, lang, t }) {
  return (
    <Link
      to={`/news/${article.id}`}
      className="rn-card"
      ref={el => attachNewsPrefetch(el, article.id, lang)}
    >
      {article.image
        ? <div className="rn-card__img" style={{ backgroundImage: `url(${article.image})` }} />
        : <div className="rn-card__img rn-card__img--placeholder" />
      }
      <div className="rn-card__body">
        <span className="rn-card__tag" style={{ background: sourceColor(article.source) }}>{article.source}</span>
        {article.is_video && <span className="rn-card__video">▶</span>}
        <p className="rn-card__title">{article.title}</p>
        <div className="rn-card__footer">
          <div className="rn-card__source-dot" style={{ background: sourceColor(article.source) }} />
          <span className="rn-card__time">{relativeTime(article.published_at, t)}</span>
        </div>
      </div>
    </Link>
  )
}

export default function RelatedNewsStrip({
  title,
  lang,
  query = null,
  relatedId = null,
  leagues = null,
  limit = 4,
  seeMoreTo = "/news",
  empty = null,
}) {
  const { t } = useTranslation()
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setArticles([])

    const load = async () => {
      if (relatedId) {
        const { data, ok } = await fetchJson(`/api/v1/news/${relatedId}/related?lang=${lang}&limit=${limit}`)
        if (!cancelled && ok && Array.isArray(data)) setArticles(data)
        return
      }

      const params = new URLSearchParams({ lang, limit: String(limit) })
      if (query) params.set("q", query)
      if (leagues) params.set("leagues", leagues)
      if (!query && !leagues) return

      const { data, ok } = await fetchJson(`/api/v1/news?${params}`)
      if (!cancelled && ok && Array.isArray(data)) setArticles(data)
    }

    load()
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [lang, query, relatedId, leagues, limit])

  if (!loading && articles.length === 0) {
    return empty
  }

  if (loading && articles.length === 0) {
    return (
      <section className="related-news">
        <div className="related-news__header">
          <h3 className="related-news__title">{title}</h3>
        </div>
        <div className="related-news__scroll">
          {[0, 1, 2].map(i => (
            <div key={i} className="rn-card rn-card--skeleton">
              <div className="loading-shimmer rn-card__img" />
              <div className="rn-card__body">
                <div className="loading-shimmer" style={{ height: 12, width: "40%", borderRadius: 4, marginBottom: 8 }} />
                <div className="loading-shimmer" style={{ height: 14, width: "90%", borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (articles.length === 0) return null

  return (
    <section className="related-news">
      <div className="related-news__header">
        <h3 className="related-news__title">{title}</h3>
        {seeMoreTo && (
          <Link to={seeMoreTo} className="related-news__more">{t("news.seeMore")}</Link>
        )}
      </div>
      <div className="related-news__scroll">
        {articles.map(a => (
          <NewsCardInner key={a.id} article={a} lang={lang} t={t} />
        ))}
      </div>
    </section>
  )
}
