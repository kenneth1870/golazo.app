import { useState, useEffect, useRef, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAppFocus } from "../hooks/useAppFocus"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchWithTimeout } from "../utils/fetchWithTimeout"
import { useFavorites } from "../hooks/useFavorites"
import { translateTeam } from "../i18n/teamNames"

const PAGE_SIZE = 12

// ── Featured card: full-bleed image with gradient overlay ─────────────────
function FeaturedCard({ article }) {
  const bg = article.image
    ? `url(${article.image}), url('/images/hero_2.jpg')`
    : "url('/images/hero_2.jpg')"
  return (
    <Link to={`/news/${article.id}`} className="nc-featured" style={{ textDecoration: "none" }}>
      <div className="nc-featured__img" style={{ backgroundImage: bg }} />
      <div className="nc-featured__overlay">
        <div className="nc-featured__meta">
          <span className="nc-featured__date">{article.date_label}</span>
        </div>
        <h2 className="nc-featured__title">{article.title}</h2>
        {article.summary && <p className="nc-featured__summary">{article.summary}</p>}
      </div>
    </Link>
  )
}

// ── Medium card (2-col): overlay style ───────────────────────────────────
function MediumCard({ article }) {
  const bg = article.image
    ? `url(${article.image}), url('/images/hero_2.jpg')`
    : "url('/images/hero_2.jpg')"
  return (
    <Link to={`/news/${article.id}`} className="nc-medium" style={{ textDecoration: "none" }}>
      <div className="nc-medium__img" style={{ backgroundImage: bg }} />
      <div className="nc-medium__overlay">
        <h3 className="nc-medium__title">{article.title}</h3>
        <span className="nc-medium__date">{article.date_label}</span>
      </div>
    </Link>
  )
}

// ── Compact card (3-col+): horizontal thumbnail + text ────────────────────
function CompactCard({ article }) {
  return (
    <Link to={`/news/${article.id}`} className="nc-compact" style={{ textDecoration: "none" }}>
      <div
        className="nc-compact__thumb"
        style={{
          backgroundImage: article.image
            ? `url(${article.image}), url('/images/hero_2.jpg')`
            : "url('/images/hero_2.jpg')",
        }}
      />
      <div className="nc-compact__body">
        <div className="nc-compact__meta">
          <span className="nc-compact__date">{article.date_label}</span>
        </div>
        <h4 className="nc-compact__title">{article.title}</h4>
        {article.summary && <p className="nc-compact__summary">{article.summary}</p>}
      </div>
    </Link>
  )
}

/**
 * Returns true if an article is relevant to any of the given team names.
 * Checks title and summary (case-insensitive).
 */
function isRelevantTo(article, teamNames, competitionNames, lang) {
  if (!teamNames.length && !competitionNames.length) return false
  const haystack = `${article.title} ${article.summary || ""}`.toLowerCase()
  const needles = new Set()

  teamNames.forEach(name => {
    if (!name) return
    needles.add(name.toLowerCase())
    const translated = translateTeam(name, lang)
    if (translated) needles.add(translated.toLowerCase())
    name.toLowerCase().split(/\s+/).filter(w => w.length >= 4).forEach(w => needles.add(w))
  })
  competitionNames.forEach(name => {
    if (!name) return
    name.toLowerCase().split(/\s+/).filter(w => w.length >= 4).forEach(w => needles.add(w))
  })

  return [...needles].some(word => haystack.includes(word))
}

export default function NewsPage() {
  const { t, i18n }    = useTranslation()
  const { favoriteTeams, favoriteCompetitions } = useFavorites()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const [searchParams, setSearchParams] = useSearchParams()
  usePageMeta(t("news.title"), clubsPrimary ? t("news.metaDescClubs") : t("news.metaDesc"))

  const [articles, setArticles]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [source, setSource]           = useState(null)   // null = "All"
  const tab = searchParams.get("tab") === "foryou" ? "foryou" : "all"

  const selectTab = useCallback((key) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (key === "all") next.delete("tab")
      else next.set("tab", key)
      return next
    }, { replace: true })
  }, [setSearchParams])
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sentinelRef = useRef(null)

  const loadNews = useCallback(() => {
    setLoading(true)
    setError(false)
    setSource(null)
    setVisibleCount(PAGE_SIZE)
    const leagueCodes = clubsPrimary
      ? [...new Set(favoriteCompetitions.map(f => f.code).filter(Boolean))]
      : []
    const leaguesParam = leagueCodes.length ? `&leagues=${encodeURIComponent(leagueCodes.join(","))}` : ""
    fetchWithTimeout(`/api/v1/news?lang=${i18n.language}${leaguesParam}`)
      .then(r => r.json())
      .then(setArticles)
      .catch(() => { setError(true); setArticles([]) })
      .finally(() => setLoading(false))
  }, [i18n.language, clubsPrimary, favoriteCompetitions])

  useEffect(() => { loadNews() }, [loadNews])

  const allLabel = t("news.all", "All")
  const sources  = [allLabel, ...new Set(articles.map(a => a.source))]
  const active   = source ?? allLabel

  // For You: articles matching followed teams or competitions
  const followedTeamNames = favoriteTeams.map(f => f.name)
  const followedCompNames = favoriteCompetitions.map(f => f.name)
  const forYouArticles = articles.filter(a => isRelevantTo(a, followedTeamNames, followedCompNames, i18n.language))

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
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_6.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("news.title")}</h1>
          <p className="page-hero__sub">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner" style={{ overflowX: "auto" }} role="tablist">

            {/* For You tab — always visible; empty state guides new users */}
            <button
              role="tab"
              aria-selected={tab === "foryou"}
              aria-controls="news-tab-panel"
              className={`tab-link${tab === "foryou" ? " tab-link--active" : ""}`}
              onClick={() => { selectTab("foryou"); setSource(null) }}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span style={{ fontSize: "0.85rem" }}>⭐</span>
              {t("news.forYou", "For You")}
              {forYouArticles.length > 0 && (
                <span style={{
                  background: "var(--accent)", color: "#fff",
                  borderRadius: 10, fontSize: "0.62rem", padding: "1px 6px",
                  fontWeight: 700, lineHeight: 1.4,
                }}>
                  {forYouArticles.length}
                </span>
              )}
            </button>


            {/* "All news" button when in For You mode */}
            {tab === "foryou" && (
              <button
                role="tab"
                aria-selected={tab === "all"}
                aria-controls="news-tab-panel"
                className="tab-link"
                onClick={() => selectTab("all")}
                style={{ color: "var(--muted)" }}
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
              <p style={{ color: "var(--muted)", maxWidth: 300, textAlign: "center" }}>
                {t(clubsPrimary ? "news.forYouEmptyHintClubs" : "news.forYouEmptyHint")}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
                {clubsPrimary && (
                  <Link to="/leagues" className="btn btn-primary btn-sm">{t("nav.leagues")}</Link>
                )}
                <Link to="/" className="btn btn-outline-light btn-sm">{t("home.followTeam")}</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="site-section" id="news-tab-panel" role="tabpanel">
        <div className="container">
          {loading ? (
            <div className="news-editorial-grid">
              <div className="loading-shimmer" style={{ borderRadius: 14, aspectRatio: "16/7" }} />
              <div className="nc-medium-row">
                <div className="loading-shimmer" style={{ borderRadius: 12, aspectRatio: "4/3" }} />
                <div className="loading-shimmer" style={{ borderRadius: 12, aspectRatio: "4/3" }} />
              </div>
              <div className="nc-compact-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="loading-shimmer" style={{ borderRadius: 12, height: 200 }} />
                ))}
              </div>
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoadNews")}</p>
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
                  fontSize: "0.82rem", color: "var(--muted)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>⭐</span>
                  <span>
                    {t("news.forYouShowing", "Showing news for {{teams}}", {
                      teams: [...followedTeamNames, ...followedCompNames].slice(0, 3).join(", ") + (followedTeamNames.length + followedCompNames.length > 3 ? ` +${followedTeamNames.length + followedCompNames.length - 3}` : ""),
                    })}
                  </span>
                </div>
              )}

              {(() => {
                const isEditorial = tab === "all" && active === allLabel
                if (!isEditorial) {
                  // Filtered view: compact grid only
                  return (
                    <div className="nc-compact-grid">
                      {visible.map((article, i) => (
                        <CompactCard key={article.id ?? i} article={article} />
                      ))}
                    </div>
                  )
                }
                // Editorial layout: featured → medium row → compact grid
                const [featured, ...rest] = visible
                const mediumPair = rest.slice(0, 2)
                const compacts   = rest.slice(2)
                return (
                  <div className="news-editorial-grid">
                    {featured && <FeaturedCard article={featured} />}
                    {mediumPair.length > 0 && (
                      <div className="nc-medium-row">
                        {mediumPair.map((a, i) => <MediumCard key={a.id ?? i} article={a} />)}
                      </div>
                    )}
                    {compacts.length > 0 && (
                      <div className="nc-compact-grid">
                        {compacts.map((a, i) => <CompactCard key={a.id ?? i} article={a} />)}
                      </div>
                    )}
                  </div>
                )
              })()}

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
