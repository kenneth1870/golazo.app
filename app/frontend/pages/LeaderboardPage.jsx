import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { storageGet, storageSet } from "../utils/safeStorage"

const DEVICE_KEY = "golazo_device_id"

function getDeviceId() {
  let id = storageGet(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    storageSet(DEVICE_KEY, id)
  }
  return id
}

export default function LeaderboardPage() {
  const { t } = useTranslation()
  usePageMeta("Prediction Leaderboard", "Top score predictors for FIFA World Cup 2026 — who called the most goals?")
  const navigate  = useNavigate()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)
  const deviceId = getDeviceId()

  function copyShareLink() {
    const url = `${window.location.origin}/compare?friend=${encodeURIComponent(deviceId)}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  useEffect(() => {
    fetch("/api/v1/score_predictions/leaderboard")
      .then(r => r.json())
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const MEDALS = ["🥇", "🥈", "🥉"]

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="match-back-bar" style={{ marginBottom: 0 }}>
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>

        <div style={{ padding: "32px 0 20px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🏆</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>{t("leaderboard.title")}</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 16px" }}>
            {t("leaderboard.subtitle")}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={copyShareLink}
              style={{
                background: copied ? "#10b981" : "rgba(238,30,70,.15)",
                border: `1px solid ${copied ? "#10b981" : "rgba(238,30,70,.3)"}`,
                color: copied ? "#fff" : "#ee1e46",
                borderRadius: 20, padding: "6px 16px", fontSize: "0.78rem",
                fontWeight: 700, cursor: "pointer", transition: ".2s",
              }}
            >
              {copied ? t("leaderboard.linkCopied") : t("leaderboard.challengeFriend")}
            </button>
            <Link to={`/compare?friend=${encodeURIComponent(deviceId)}`}
              style={{
                background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.25)",
                color: "#818cf8", borderRadius: 20, padding: "6px 16px",
                fontSize: "0.78rem", fontWeight: 700, textDecoration: "none",
              }}
            >
              {t("leaderboard.myComparisons")}
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎯</div>
            <h3>{t("leaderboard.noPredictions")}</h3>
            <p>{t("leaderboard.beFirst")}</p>
          </div>
        ) : (
          <div className="widget-next-match">
            <div className="widget-body p-0">
              {rows.map((r, i) => {
                const isMe = r.device_id === deviceId
                return (
                  <div
                    key={r.device_id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border)",
                      background: isMe ? "rgba(238,30,70,.06)" : "transparent",
                      borderLeft: isMe ? "2px solid #ee1e46" : "2px solid transparent",
                    }}
                  >
                    <span style={{ width: 28, textAlign: "center", fontSize: i < 3 ? "1.2rem" : "0.85rem", color: "var(--muted)", fontWeight: 700, flexShrink: 0 }}>
                      {i < 3 ? MEDALS[i] : `#${i + 1}`}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isMe ? "#ee1e46" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.display_name}{isMe && ` ${t("leaderboard.you")}`}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
                        {t(r.predictions_made !== 1 ? "leaderboard.predictions_other" : "leaderboard.predictions_one", { count: r.predictions_made })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: "1.1rem", color: i === 0 ? "#f59e0b" : "#fff" }}>
                        {r.total_points}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{t("leaderboard.pts")}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.72rem", color: "var(--muted)" }}>
          {t("leaderboard.predictOnFixtures")}
        </p>
      </div>
    </div>
  )
}
