import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

const SOURCE_COLORS = {
  "BBC Sport": "#b80000",
  "ESPN FC":   "#cc0000",
  "Goal.com":  "#ee1e46",
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
  const { id }   = useParams()
  const { i18n } = useTranslation()
  const lang     = i18n.language.split("-")[0]
  const [article, setArticle]   = useState(null)
  const [content, setContent]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setArticle(null)
    setContent(null)

    // Fetch article meta and full content in parallel, passing lang so the
    // controller searches the correct locale's feed (e.g. Spanish articles
    // have IDs derived from Spanish URLs — not found in the English feed)
    Promise.all([
      fetch(`/api/v1/news/${id}?lang=${lang}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/news/${id}/content?lang=${lang}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([meta, body]) => {
        if (!meta) { setNotFound(true); return }
        setArticle(meta)
        setContent(body)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="site-section" style={{ padding: 0 }}><ArticleSkeleton /></div>
  }

  if (notFound || !article) {
    return (
      <div className="site-section">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state__icon">📰</div>
            <h3>Article not found</h3>
            <p><Link to="/news" style={{ color: "var(--accent)" }}>← Back to News</Link></p>
          </div>
        </div>
      </div>
    )
  }

  const color      = SOURCE_COLORS[article.source] || "#ee1e46"
  const heroImage  = content?.hero_image || article.image
  const paragraphs = content?.paragraphs || []

  return (
    <article style={{ paddingBottom: 60 }}>

      {/* Full-width hero photo */}
      {heroImage && (
        <div style={{ position: "relative", width: "100%", maxHeight: 520, overflow: "hidden", background: "#0d1117" }}>
          <img
            src={heroImage}
            alt={article.title}
            style={{
              width: "100%", maxHeight: 520,
              objectFit: "cover", objectPosition: "center top",
              display: "block",
            }}
            onError={e => { e.target.style.display = "none" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.75))",
          }} />
        </div>
      )}

      <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 20px 0" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 20, fontSize: "0.78rem", color: "var(--muted)" }}>
          <Link to="/news" style={{ color: "var(--accent)", textDecoration: "none" }}>News</Link>
          <span style={{ margin: "0 6px", opacity: .5 }}>›</span>
          <span>{article.source}</span>
        </div>

        {/* Source + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{
            background: color, color: "#fff",
            fontSize: ".62rem", fontWeight: 700, letterSpacing: ".1em",
            padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
          }}>
            {article.source}
          </span>
          {article.date_label && (
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{article.date_label}</span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(1.45rem, 4vw, 2.1rem)", fontWeight: 900,
          lineHeight: 1.28, color: "#fff", marginBottom: 28,
        }}>
          {article.title}
        </h1>

        {/* Article body */}
        {paragraphs.length > 0 ? (
          <div style={{ fontSize: "1.05rem", lineHeight: 1.8, color: "rgba(255,255,255,.82)" }}>
            {paragraphs.map((p, i) => (
              <p key={i} style={{ marginBottom: 20 }}>{p}</p>
            ))}
          </div>
        ) : article.summary ? (
          <p style={{
            fontSize: "1.05rem", lineHeight: 1.75, color: "rgba(255,255,255,.75)",
            borderLeft: "3px solid var(--accent)", paddingLeft: 16, marginBottom: 28,
          }}>
            {article.summary}
          </p>
        ) : null}

        {/* Read original link */}
        {article.link && (
          <div style={{ marginTop: 36, padding: "20px 0", borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: 12 }}>
              Original article on {article.source}
            </p>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: color, color: "#fff",
                padding: "10px 20px", borderRadius: 8,
                fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              }}
            >
              Read on {article.source} ↗
            </a>
          </div>
        )}

        {/* Back */}
        <div style={{ marginTop: 32 }}>
          <Link to="/news" style={{ color: "var(--accent)", fontSize: "0.85rem", textDecoration: "none" }}>
            ← Back to News
          </Link>
        </div>

      </div>
    </article>
  )
}
