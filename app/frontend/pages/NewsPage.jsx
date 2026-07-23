import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAppFocus } from "../hooks/useAppFocus"
import { usePageMeta } from "../hooks/usePageMeta"
import { fetchJson } from "../utils/fetchJson"
import OfflineBanner from "../components/OfflineBanner"
import { useFavorites } from "../hooks/useFavorites"
import { translateTeam } from "../i18n/teamNames"

const PAGE_SIZE = 12

function dedupeArticles(list) {
  const seenLinks = new Set()
  const seenTitles = new Set()
  return list.filter(a => {
    const link = a.link?.trim()
    const title = a.title?.toLowerCase()?.trim()
    if (link) {
      if (seenLinks.has(link)) return false
      seenLinks.add(link)
    }
    if (title) {
      if (seenTitles.has(title)) return false
      seenTitles.add(title)
    }
    return !!(link || title || a.id)
  })
}

function CompactList({ articles, mobileOnly = false }) {
  return (
    <div className={`nc-compact-grid news-feed-grid${mobileOnly ? " news-feed-grid--mobile" : ""}`}>
      {articles.map((article, i) => (
        <CompactCard key={article.id ?? `${article.link ?? "article"}-${i}`} article={article} />
      ))}
    </div>
  )
}

function NewsLoadingSkeleton() {
  return (
    <div className="nc-compact-grid news-feed-grid news-loading" aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="nc-compact news-loading__row">
          <div className="loading-shimmer news-loading__thumb" />
          <div className="news-loading__body">
            <div className="loading-shimmer news-loading__line news-loading__line--sm" />
            <div className="loading-shimmer news-loading__line news-loading__line--title" />
            <div className="loading-shimmer news-loading__line news-loading__line--summary" />
          </div>
        </div>
      ))}
    </div>
  )
}
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
  const [imgErr, setImgErr] = useState(false)
  const imgSrc = article.image && !imgErr ? article.image : "/images/hero_2.jpg"

  return (
    <Link to={`/news/${article.id}`} className="nc-compact" style={{ textDecoration: "none" }}>
      <div className="nc-compact__thumb">
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgErr(true)}
        />
      </div>
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
  const [stale, setStale]             = useState(false)
  const [source, setSource]           = useState(null)   // null = "All"
  const [reloadToken, setReloadToken]   = useState(0)
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
  const poolLengthRef = useRef(0)
  const loadingMoreRef = useRef(false)

  const leagueCodesKey = useMemo(() => {
    if (!clubsPrimary) return ""
    return [...new Set(favoriteCompetitions.map(f => f.code).filter(Boolean))].sort().join(",")
  }, [clubsPrimary, favoriteCompetitions])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)

    setLoading(true)
    setError(false)
    setStale(false)

    const leaguesParam = leagueCodesKey ? `&leagues=${encodeURIComponent(leagueCodesKey)}` : ""
    fetchJson(`/api/v1/news?lang=${i18n.language}${leaguesParam}`)
      .then(({ data, stale: isStale, offline, ok }) => {
        if (cancelled) return
        if (!ok || offline) {
          setError(true)
          setArticles([])
          setStale(isStale)
          return
        }
        setArticles(Array.isArray(data) ? data : [])
        setStale(isStale)
      })
      .catch(() => { if (!cancelled) { setError(true); setArticles([]) } })
      .finally(() => {
        clearTimeout(timer)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [i18n.language, leagueCodesKey, reloadToken])

  const retryNews = useCallback(() => {
    setSource(null)
    setVisibleCount(PAGE_SIZE)
    setReloadToken(n => n + 1)
  }, [])

  const uniqueArticles = useMemo(() => dedupeArticles(articles), [articles])

  const allLabel = t("news.all", "All")
  const sources  = [allLabel, ...new Set(uniqueArticles.map(a => a.source))]
  const active   = source ?? allLabel

  // For You: articles matching followed teams or competitions
  const followedTeamNames = favoriteTeams.map(f => f.name)
  const followedCompNames = favoriteCompetitions.map(f => f.name)
  const forYouArticles = uniqueArticles.filter(a => isRelevantTo(a, followedTeamNames, followedCompNames, i18n.language))

  // Which pool to show depending on active tab
  const pool = tab === "foryou" ? forYouArticles : (
    active === allLabel ? uniqueArticles : uniqueArticles.filter(a => a.source === active)
  )
  const visible = pool.slice(0, visibleCount)
  const hasMore = visibleCount < pool.length
  poolLengthRef.current = pool.length

  // Reset visible count when filter/tab changes
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [source, tab])

  useEffect(() => {
    loadingMoreRef.current = false
  }, [visibleCount])

  // IntersectionObserver — load next page when sentinel enters viewport
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingMoreRef.current) return
        loadingMoreRef.current = true
        setVisibleCount(n => Math.min(n + PAGE_SIZE, poolLengthRef.current))
      },
      { rootMargin: "120px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, tab, source])

  return (
    <div className="news-page">
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_6.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("news.title")}</h1>
          <p className="page-hero__sub">{t("news.subtitle")}</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner tab-bar__inner--scroll" role="tablist">

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
          <OfflineBanner stale={stale} onRetry={retryNews} />
          {loading ? (
            <NewsLoadingSkeleton />
          ) : error ? (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <p style={{ color: "var(--muted)", marginBottom: 16 }}>{t("error.failedToLoadNews")}</p>
              <button className="btn btn-primary btn-sm" onClick={retryNews}>{t("error.retry")}</button>
            </div>
          ) : visible.length === 0 && tab !== "foryou" ? (
            <div className="empty-state">
              <div className="empty-state__icon">📰</div>
              <h3>{t("news.noArticles")}</h3>
            </div>
          ) : visible.length > 0 ? (
            <>
              {tab === "foryou" && (
                <div className="news-for-you-banner">
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
                  return <CompactList articles={visible} />
                }
                const [featured, ...rest] = visible
                const mediumPair = rest.slice(0, 2)
                const compacts   = rest.slice(2)
                return (
                  <>
                    <div className="news-editorial-grid news-feed-grid--desktop">
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
                    <CompactList articles={visible} mobileOnly />
                  </>
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
    </div>
  )
}
