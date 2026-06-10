import { useState, useEffect, useRef, useCallback } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"
import { sourceColor } from "../utils/sourceColors"
import { useFavorites } from "../hooks/useFavorites"

const PAGE_SIZE = 12

function NewsCard({ article, featured }) {
  const color = sourceColor(article.source)

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

/**
 * Returns true if an article is relevant to any of the given team names.
 * Checks title and summary (case-insensitive).
 */
function isRelevantTo(article, teamNames) {
  if (!teamNames.length) return false
  const haystack = `${article.title} ${article.summary || ""}`.toLowerCase()
  return teamNames.some(name => {
    // Match on the last word of multi-word names too (e.g. "Argentina" from "CF Argentina")
    const words = name.toLowerCase().split(/\s+/).filter(w => w.length >= 4)
    return words.some(w => haystack.includes(w))
  })
}

export default function NewsPage() {
  const { t, i18n }    = useTranslation()
  const { favoriteTeams, favoriteCompetitions } = useFavorites()
  usePageMeta(t("news.title"), "Latest football news — World Cup 2026, transfers, match previews and results.")

  const [articles, setArticles]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [source, setSource]           = useState(null)   // null = "All"
  const [tab, setTab]                 = useState("all")  // "all" | "foryou"
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sentinelRef = useRef(null)

  const loadNews = useCallback(() => {
    setLoading(true)
    setError(false)
    setSource(null)
    setVisibleCount(PAGE_SIZE)
    fetchWithTimeout(`/api/v1/news?lang=${i18n.language}`)
      .then(r => r.json())
      .then(setArticles)
      .catch(() => { setError(true); setArticles([]) })
      .finally(() => setLoading(false))
  }, [i18n.language])

  useEffect(() => { loadNews() }, [loadNews])

  const allLabel = t("news.all", "All")
  const sources  = [allLabel, ...new Set(articles.map(a => a.source))]
  const active   = source ?? allLabel

  // For You: articles matching followed teams or competitions
  const followedNames = [
    ...favoriteTeams.map(f => f.name),
    ...favoriteCompetitions.map(f => f.name),
  ]
  const forYouArticles = articles.filter(a => isRelevantTo(a, followedNames))
  const hasForYou      = followedNames.length > 0

  // Which pool to show depending on active tab
  const pool = tab === "foryou" ? forYouArticles : (
    active === allLabel ? articles : articles.filter(a => a.source === active)
  )
  const visible = pool.slice(0, visibleCount)
  const hasMore = visibleCount < pool.length

  // Reset visible count when filter/tab changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [source, tab])

  // IntersectionObserver — load next page when sentinel enters viewport
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(n => n + PAGE_SIZE) },
      { rootMargin: "200px" }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, visible.length])

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

            {/* For You tab — only shown if user has favorites */}
            {hasForYou && (
              <button
                className={`tab-link${tab === "foryou" ? " tab-link--active" : ""}`}
                onClick={() => { setTab("foryou"); setSource(null) }}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <span style={{ fontSize: "0.85rem" }}>⭐</span>
                {t("news.forYou", "For You")}
                {forYouArticles.length > 0 && (
                  <span style={{
                    background: "var(--accent,#ee1e46)", color: "#fff",
                    borderRadius: 10, fontSize: "0.62rem", padding: "1px 6px",
                    fontWeight: 700, lineHeight: 1.4,
                  }}>
                    {forYouArticles.length}
                  </span>
                )}
              </button>
            )}

            {/* Source tabs — only shown in "all" tab mode */}
            {tab === "all" && sources.map(s => (
              <button
                key={s}
                className={`tab-link${active === s ? " tab-link--active" : ""}`}
                onClick={() => setSource(s === allLabel ? null : s)}
              >
                {s}
              </button>
            ))}

            {/* "All news" button when in For You mode */}
            {tab === "foryou" && (
              <button
                className="tab-link"
                onClick={() => setTab("all")}
                style={{ color: "var(--muted,#888)" }}
              >
                {t("news.allNews", "All news")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* For You empty state — prompt to follow teams */}
      {tab === "foryou" && !loading && forYouArticles.length === 0 && (
        <div className="site-section">
          <div className="container">
            <div className="empty-state">
              <div className="empty-state__icon">⭐</div>
              <h3>{t("news.forYouEmpty", "No personalised news yet")}</h3>
              <p style={{ color: "var(--muted,#888)", maxWidth: 300, textAlign: "center" }}>
                {t("news.forYouEmptyHint", "Follow teams from team pages or the Mundial section to see their news here.")}
              </p>
            </div>
          </div>
        </div>
      )}

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
          ) : error ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <p style={{ color: "#888", marginBottom: 16 }}>{t("error.failedToLoadNews")}</p>
              <button className="btn btn-primary btn-sm" onClick={loadNews}>{t("error.retry")}</button>
            </div>
          ) : visible.length === 0 && tab !== "foryou" ? (
            <div className="empty-state">
              <div className="empty-state__icon">📰</div>
              <h3>{t("news.noArticles")}</h3>
            </div>
          ) : visible.length > 0 ? (
            <>
              {tab === "foryou" && (
                <div style={{
                  marginBottom: 20, padding: "10px 14px", borderRadius: 10,
                  background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.2)",
                  fontSize: "0.82rem", color: "var(--muted,#888)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>⭐</span>
                  <span>
                    {t("news.forYouShowing", "Showing news for {{teams}}", {
                      teams: followedNames.slice(0, 3).join(", ") + (followedNames.length > 3 ? ` +${followedNames.length - 3}` : ""),
                    })}
                  </span>
                </div>
              )}

              <div className="row">
                {visible.map((article, i) => (
                  <div key={article.id ?? i} className={`col-lg-${i === 0 && tab === "all" && active === allLabel ? "12" : "6"} mb-4`}>
                    <NewsCard article={article} featured={i === 0 && tab === "all" && active === allLabel} />
                  </div>
                ))}
              </div>

              {hasMore && (
                <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <div className="spinner" />
                </div>
              )}

              {!hasMore && pool.length > PAGE_SIZE && (
                <p style={{ textAlign: "center", color: "#555", fontSize: "0.8rem", paddingBottom: 24 }}>
                  {t("news.allLoaded", { count: pool.length })}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
