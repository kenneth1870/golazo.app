import { useState, useEffect, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { useAppFocus } from "../hooks/useAppFocus"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"

const SOURCE_COLORS = {
  "BBC Sport":     "#b80000",
  "ESPN FC":       "#cc0000",
  "ESPN Deportes": "#cc0000",
  "Goal.com":      "var(--accent)",
}

function ArticleSkeleton() {
  return (
    <div className="container" style={{ maxWidth: 740, paddingTop: 32 }}>
      <div className="loading-shimmer" style={{ height: 420, borderRadius: 0, marginBottom: 32 }} />
      <div className="loading-shimmer" style={{ height: 28, width: "60%", borderRadius: 6, marginBottom: 12 }} />
      <div className="loading-shimmer" style={{ height: 40, borderRadius: 6, marginBottom: 8 }} />
      <div className="loading-shimmer" style={{ height: 40, width: "80%", borderRadius: 6, marginBottom: 32 }} />
      {[100, 95, 88, 100, 72].map((w, i) => (
        <div key={i} className="loading-shimmer" style={{ height: 18, width: `${w}%`, borderRadius: 4, marginBottom: 10 }} />
      ))}
    </div>
  )
}

export default function NewsShowPage() {
  const { id }      = useParams()
  const { t, i18n } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const navigate = useNavigate()
  const lang     = i18n.language.split("-")[0]
  const [article, setArticle]   = useState(null)
  const [content, setContent]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [stale, setStale]       = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setArticle(null)
    setContent(null)
    setNotFound(false)
    setStale(false)

    Promise.all([
      fetchJson(`/api/v1/news/${id}?lang=${lang}`),
      fetchJson(`/api/v1/news/${id}/content?lang=${lang}`),
    ])
      .then(([metaRes, bodyRes]) => {
        setStale(metaRes.stale || bodyRes.stale)
        const meta = metaRes.ok && metaRes.data ? metaRes.data : null
        if (!meta) { setNotFound(true); return }
        setArticle(meta)
        setContent(bodyRes.ok ? bodyRes.data : null)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, lang])

  useEffect(() => { load() }, [load])

  // Hooks must be unconditional — pass null when article not loaded yet
  const heroImageEarly = content?.hero_image || article?.image
  usePageMeta(
    article?.title || null,
    article?.description || (article?.title
      ? t(clubsPrimary ? "news.metaDescArticleClubs" : "news.metaDescArticle", { title: article.title })
      : null),
    { type: "article", image: heroImageEarly || undefined }
  )
  useStructuredData(article ? {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.description || article.title,
    "image": heroImageEarly ? [heroImageEarly] : undefined,
    "datePublished": article.published_at,
    "publisher": {
      "@type": "Organization",
      "name": article.source || "Golazo",
    },
    "url": typeof window !== "undefined" ? window.location.href : undefined,
  } : null)

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div style={{ padding: 0 }}>
        <div className="match-back-bar">
          <div className="container" style={{ maxWidth: 740 }}>
            <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
          </div>
        </div>
        <ArticleSkeleton />
      </div>
    )
  }

  if (notFound || !article) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state__icon">📰</div>
            <h3>{t("news.notFound")}</h3>
            <p><Link to="/news" className="news-article__back">← {t("news.backToNews")}</Link></p>
          </div>
        </div>
      </div>
    )
  }

  const color      = SOURCE_COLORS[article.source] || "var(--accent)"
  const heroImage  = content?.hero_image || article.image
  const paragraphs = content?.paragraphs || []

  return (
    <article className="news-article">
      <OfflineBanner stale={stale} onRetry={load} />

      <div className="match-back-bar">
        <div className="container news-article__toolbar">
          <button type="button" onClick={() => navigate(-1)} className="btn-back">← {t("nav.back")}</button>
          <button
            type="button"
            onClick={share}
            className={`news-article__share${copied ? " news-article__share--copied" : ""}`}
          >
            {copied ? t("match.copied") : t("match.share")}
          </button>
        </div>
      </div>

      {heroImage && (
        <div className="news-article__hero">
          <img
            src={heroImage}
            alt=""
            className="news-article__hero-img"
            onError={e => { e.target.style.display = "none" }}
          />
          <div className="news-article__hero-scrim" aria-hidden="true" />
        </div>
      )}

      <div className="container news-article__body">

        <nav className="news-article__breadcrumb" aria-label={t("nav.news")}>
          <Link to="/news">{t("nav.news")}</Link>
          <span aria-hidden="true">›</span>
          <span>{article.source}</span>
        </nav>

        <div className="news-article__meta">
          <span className="news-article__source" style={{ background: color }}>
            {article.source}
          </span>
          {article.date_label && (
            <time className="news-article__date">{article.date_label}</time>
          )}
        </div>

        <h1 className="news-article__title">{article.title}</h1>

        {paragraphs.length > 0 ? (
          <div className="news-article__content">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        ) : article.summary ? (
          <p className="news-article__summary">{article.summary}</p>
        ) : null}

        {paragraphs.length < 3 && article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="news-article__cta"
          >
            {t("news.readOn", { source: article.source })}
          </a>
        )}

        <footer className="news-article__footer">
          <Link to="/news" className="news-article__back">
            ← {t("news.backToNews")}
          </Link>
        </footer>

      </div>
    </article>
  )
}
