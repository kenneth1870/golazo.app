import { useState, useEffect, useCallback } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { useStructuredData } from "../hooks/useStructuredData"
import { useAppFocus } from "../hooks/useAppFocus"
import { fetchJson } from "../utils/fetchJson"
import { consumePrefetchedArticle } from "../utils/newsPrefetch"
import OfflineBanner from "../components/OfflineBanner"
import RelatedNewsStrip from "../components/RelatedNewsStrip"
import NewsArticleBody from "../components/NewsArticleBody"
import { sourceColor } from "../utils/sourceColors"

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
  const [article, setArticle]         = useState(null)
  const [content, setContent]         = useState(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(true)
  const [notFound, setNotFound]       = useState(false)
  const [contentError, setContentError] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [stale, setStale]             = useState(false)

  const load = useCallback(async () => {
    setMetaLoading(true)
    setContentLoading(true)
    setArticle(null)
    setContent(null)
    setNotFound(false)
    setContentError(false)
    setStale(false)

    const prefetched = consumePrefetchedArticle(id, lang)
    if (prefetched) {
      try {
        const { meta, content: body } = await prefetched
        if (!meta) { setNotFound(true); return }
        setArticle(meta)
        setContent(body)
        return
      } catch {
        // fall through to network fetch
      } finally {
        setMetaLoading(false)
        setContentLoading(false)
      }
    }

    try {
      const metaRes = await fetchJson(`/api/v1/news/${id}?lang=${lang}`)
      setStale(metaRes.stale)
      const meta = metaRes.ok && metaRes.data ? metaRes.data : null
      if (!meta) { setNotFound(true); return }
      setArticle(meta)
    } catch {
      setNotFound(true)
      return
    } finally {
      setMetaLoading(false)
    }

    fetchJson(`/api/v1/news/${id}/content?lang=${lang}`)
      .then(bodyRes => {
        setStale(prev => prev || bodyRes.stale)
        if (!bodyRes.ok || bodyRes.offline) {
          setContentError(true)
          return
        }
        setContent(bodyRes.data)
      })
      .catch(() => setContentError(true))
      .finally(() => setContentLoading(false))
  }, [id, lang])

  useEffect(() => { load() }, [load])

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

  async function share() {
    const url = window.location.href
    if (navigator.share && article?.title) {
      try {
        await navigator.share({ title: article.title, url })
        return
      } catch (err) {
        if (err?.name === "AbortError") return
      }
    }
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (metaLoading && !article) {
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

  const color      = sourceColor(article.source)
  const heroImage  = content?.hero_image || article.image
  const isVideo    = content?.is_video || article.is_video
  const paragraphs = (() => {
    const body = (content?.paragraphs || []).filter(Boolean)
    if (body.length > 0) return body
    return article.summary ? [article.summary] : []
  })()
  const readingMin = content?.reading_time_min || article.reading_time_min || Math.max(1, Math.ceil(paragraphs.join(" ").split(/\s+/).length / 200))

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
          {isVideo && (
            <span className="news-article__video-badge">{t("news.videoArticle")}</span>
          )}
          {article.date_label && (
            <time className="news-article__date">{article.date_label}</time>
          )}
          {readingMin > 0 && (
            <span className="news-article__reading-time">
              {t("news.readingTime", { count: readingMin })}
            </span>
          )}
        </div>

        <h1 className="news-article__title">{article.title}</h1>

        {contentError && !contentLoading && (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: "0.88rem" }}>
            {t("error.failedToLoadNews")}
            <button
              type="button"
              onClick={load}
              style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.88rem", textDecoration: "underline" }}
            >
              {t("error.retry")}
            </button>
          </div>
        )}

        <NewsArticleBody
          paragraphs={paragraphs}
          images={content?.images}
          loading={contentLoading && !content && !contentError}
        />

        <RelatedNewsStrip
          title={t("news.related")}
          lang={lang}
          relatedId={id}
          limit={4}
        />

        <footer className="news-article__footer">
          <Link to="/news" className="news-article__back">
            ← {t("news.backToNews")}
          </Link>
        </footer>

      </div>
    </article>
  )
}
