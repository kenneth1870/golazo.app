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
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [copied, setCopied]         = useState(false)
  const [visibleCount, setVisible]  = useState(25)
  const [myPreds, setMyPreds]         = useState(null)
  const [showMyPreds, setShowMyPreds] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState("")
  const [nameSaved, setNameSaved]     = useState(false)
  const deviceId = getDeviceId()

  function copyShareLink() {
    const url = `${window.location.origin}/compare?friend=${encodeURIComponent(deviceId)}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function saveName() {
    const name = nameInput.trim()
    if (!name) return
    fetch("/api/v1/score_predictions/update_name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, display_name: name }),
    })
      .then(r => r.json())
      .then(() => {
        setNameSaved(true)
        setEditingName(false)
        setRows(prev => prev.map(r => r.device_id === deviceId ? { ...r, display_name: name } : r))
        setTimeout(() => setNameSaved(false), 3000)
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetch("/api/v1/score_predictions/leaderboard")
      .then(r => r.json())
      .then(data => {
        setRows(data)
        const myIdx = data.findIndex(r => r.device_id === deviceId)
        if (myIdx > 24) setVisible(myIdx + 5)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  useEffect(() => {
    fetch(`/api/v1/score_predictions/by_device?device_id=${encodeURIComponent(deviceId)}`)
      .then(r => r.json())
      .then(d => { if (d.predictions?.length) setMyPreds(d) })
      .catch(() => {})
  }, []) // eslint-disable-line

  const MEDALS = ["🥇", "🥈", "🥉"]

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="match-back-bar" style={{ marginBottom: 0 }}>
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>

        <div style={{ padding: "32px 0 20px", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🏆</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--text)", margin: "0 0 4px" }}>{t("leaderboard.title")}</h1>
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
            <button
              onClick={() => { setEditingName(v => !v); setNameInput("") }}
              style={{
                background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)",
                color: "#f59e0b", borderRadius: 20, padding: "6px 16px",
                fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              ✏️ {t("leaderboard.changeName", "Set Name")}
            </button>
          </div>

          {/* Inline name editor */}
          {editingName && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center" }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value.slice(0, 32))}
                onKeyDown={e => e.key === "Enter" && saveName()}
                placeholder="Your display name…"
                maxLength={32}
                autoFocus
                style={{
                  background: "var(--surface2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "7px 12px", color: "var(--text)", fontSize: "0.85rem",
                  fontFamily: "inherit", width: 200, outline: "none",
                }}
              />
              <button
                onClick={saveName}
                disabled={!nameInput.trim()}
                style={{
                  background: "#ee1e46", border: "none", borderRadius: 8,
                  padding: "7px 14px", color: "#fff", fontWeight: 700, fontSize: "0.82rem",
                  cursor: nameInput.trim() ? "pointer" : "default", opacity: nameInput.trim() ? 1 : 0.5,
                }}
              >Save</button>
            </div>
          )}
          {nameSaved && (
            <div style={{ marginTop: 8, color: "#10b981", fontSize: "0.75rem", fontWeight: 700 }}>✓ Name updated on all your predictions</div>
          )}
        </div>

        {/* My predictions panel */}
        {myPreds && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowMyPreds(v => !v)}
              style={{
                width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "11px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text)" }}>
                🎯 {t("leaderboard.myPredictions", "My Predictions")}
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                {myPreds.total_points} pts · {myPreds.predictions.length} graded {showMyPreds ? "▲" : "▼"}
              </span>
            </button>
            {showMyPreds && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                {myPreds.predictions.map((p, i) => {
                  const pts = p.points_earned ?? 0
                  const ptsColor = pts >= 3 ? "#10b981" : pts >= 1 ? "#f59e0b" : "var(--muted)"
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                      borderBottom: i < myPreds.predictions.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.home_team_name} vs {p.away_team_name}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>
                          {t("leaderboard.yourGuess", "Your guess")}: {p.home_guess}–{p.away_guess}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: "1rem", color: ptsColor }}>{pts > 0 ? `+${pts}` : pts}</div>
                        <div style={{ fontSize: "0.6rem", color: "var(--muted)" }}>pts</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎯</div>
            <h3>{t("leaderboard.noPredictions")}</h3>
            <p>{t("leaderboard.beFirst")}</p>
          </div>
        ) : (
          <>
          <div className="widget-next-match">
            <div className="widget-body p-0">
              {rows.slice(0, visibleCount).map((r, i) => {
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
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isMe ? "#ee1e46" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.display_name}{isMe && ` ${t("leaderboard.you")}`}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
                        {t(r.predictions_made !== 1 ? "leaderboard.predictions_other" : "leaderboard.predictions_one", { count: r.predictions_made })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: "1.1rem", color: i === 0 ? "#f59e0b" : "var(--text)" }}>
                        {r.total_points}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{t("leaderboard.pts")}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {rows.length > visibleCount && (
            <button
              onClick={() => setVisible(v => v + 25)}
              style={{
                display: "block", width: "100%", marginTop: 12,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 0", color: "var(--muted)",
                fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                transition: "border-color .15s",
              }}
              onMouseEnter={e => (e.target.style.borderColor = "rgba(255,255,255,.2)")}
              onMouseLeave={e => (e.target.style.borderColor = "var(--border)")}
            >
              {t("leaderboard.loadMore", { remaining: rows.length - visibleCount })}
            </button>
          )}
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.72rem", color: "var(--muted)" }}>
          {t("leaderboard.predictOnFixtures")}
        </p>
      </div>
    </div>
  )
}
