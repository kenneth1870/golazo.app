import { useState, useEffect } from "react"
import { useAuthContext } from "../../contexts/AuthContext"

export default function AdminNewsPage() {
  const { authFetch } = useAuthContext()
  const [articles, setArticles] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    authFetch("/api/v1/admin/news")
      .then(r => r.json())
      .then(d => setArticles(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, marginBottom: 6 }}>News</h1>
      <p style={{ color: "rgba(255,255,255,.35)", marginBottom: 24, fontSize: "0.85rem" }}>
        Latest articles from the news service — {articles.length} loaded
      </p>

      {loading ? (
        <div style={{ color: "rgba(255,255,255,.4)" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {articles.map((a, i) => (
            <div key={a.id || i} style={{
              background: "#161b22", border: "1px solid rgba(255,255,255,.07)",
              borderRadius: 10, padding: "14px 18px",
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              {a.image && (
                <img src={a.image} alt="" style={{ width: 80, height: 54, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} onError={e => e.target.style.display = "none"} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4, lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: "rgba(255,255,255,.35)", fontSize: "0.75rem" }}>{a.source}</span>
                  {a.published_at && (
                    <span style={{ color: "rgba(255,255,255,.25)", fontSize: "0.72rem" }}>
                      {new Date(a.published_at).toLocaleDateString()}
                    </span>
                  )}
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noopener noreferrer" style={{ color: "#ee1e46", fontSize: "0.72rem", textDecoration: "none" }}>
                      View ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          {articles.length === 0 && (
            <div style={{ color: "rgba(255,255,255,.3)", textAlign: "center", padding: "40px" }}>No articles</div>
          )}
        </div>
      )}
    </div>
  )
}
