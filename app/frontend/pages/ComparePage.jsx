import { useState, useEffect } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
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

function PtsBadge({ pts }) {
  const color = pts === 3 ? "#10b981" : pts === 1 ? "#f59e0b" : pts === 0 ? "#ef4444" : "var(--muted)"
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 26, height: 26, borderRadius: "50%",
      background: pts != null ? `${color}22` : "transparent",
      color, fontWeight: 900, fontSize: "0.78rem", flexShrink: 0,
    }}>
      {pts != null ? pts : "–"}
    </span>
  )
}

export default function ComparePage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  usePageMeta("Prediction Comparison", "Compare your FIFA World Cup 2026 score predictions with a friend.")

  const myDeviceId     = getDeviceId()
  const friendDeviceId = searchParams.get("friend") || ""
  const [myData,     setMyData]     = useState(null)
  const [friendData, setFriendData] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const fetchPreds = (deviceId) =>
      fetch(`/api/v1/score_predictions/by_device?device_id=${encodeURIComponent(deviceId)}`)
        .then(r => r.json())
        .catch(() => null)

    Promise.all([
      fetchPreds(myDeviceId),
      friendDeviceId ? fetchPreds(friendDeviceId) : Promise.resolve(null),
    ]).then(([me, friend]) => {
      setMyData(me)
      setFriendData(friend)
    }).finally(() => setLoading(false))
  }, [myDeviceId, friendDeviceId])

  // Share own link
  const shareUrl = `${window.location.origin}/compare?friend=${encodeURIComponent(myDeviceId)}`
  const [copied, setCopied] = useState(false)
  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Build merged match list
  const buildMatchMap = (data) => {
    if (!data?.predictions) return {}
    return data.predictions.reduce((acc, p) => {
      acc[p.match_external_id] = p
      return acc
    }, {})
  }

  const myMap     = buildMatchMap(myData)
  const friendMap = buildMatchMap(friendData)

  // All match IDs from both
  const allMatchIds = [...new Set([...Object.keys(myMap), ...Object.keys(friendMap)])]
    .sort((a, b) => {
      // Sort by points desc (matches where someone scored more first)
      const ap = (myMap[a]?.points_earned ?? 0) + (friendMap[a]?.points_earned ?? 0)
      const bp = (myMap[b]?.points_earned ?? 0) + (friendMap[b]?.points_earned ?? 0)
      return bp - ap
    })

  const matchName = (id) => {
    const p = myMap[id] || friendMap[id]
    if (!p) return id
    return p.home_team_name && p.away_team_name
      ? `${p.home_team_name} vs ${p.away_team_name}`
      : `Match ${id}`
  }

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 640 }}>
        {/* Back */}
        <div className="match-back-bar" style={{ marginBottom: 0 }}>
          <button onClick={() => navigate("/leaderboard")} className="btn-back" style={{ padding: "10px 0" }}>{t("compare.backToLeaderboard")}</button>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚔️</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>{t("compare.title")}</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>
            {friendData?.display_name
              ? t("compare.vsSubtitle", { name: friendData.display_name })
              : t("compare.sharePrompt").split(":")[0]}
          </p>
        </div>

        {/* Share box */}
        {!friendDeviceId && (
          <div className="widget-next-match" style={{ marginBottom: 20 }}>
            <div className="widget-body">
              <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.75)", margin: "0 0 12px" }}>
                {t("compare.sharePrompt")}
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <code style={{
                  flex: 1, minWidth: 0, fontSize: "0.72rem", padding: "8px 12px",
                  background: "var(--surface2)", borderRadius: 8, color: "var(--muted)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {shareUrl}
                </code>
                <button
                  onClick={copyLink}
                  style={{
                    background: copied ? "#10b981" : "#ee1e46", color: "#fff",
                    border: "none", borderRadius: 8, padding: "8px 16px",
                    fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
                    flexShrink: 0, transition: "background .2s",
                  }}
                >
                  {copied ? t("compare.copied") : t("compare.copyLink")}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
        ) : (
          <>
            {/* Score totals */}
            {(myData || friendData) && (
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{
                  flex: 1, textAlign: "center", background: "rgba(238,30,70,.08)",
                  border: "1px solid rgba(238,30,70,.2)", borderRadius: 12, padding: "16px 8px",
                }}>
                  <div style={{ fontSize: "2rem", fontWeight: 900, color: "#ee1e46" }}>{myData?.total_points ?? 0}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 4 }}>{t("compare.you")}</div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.6)", marginTop: 2, fontWeight: 700 }}>
                    {myData?.display_name || t("compare.you")}
                  </div>
                </div>
                {friendData && (
                  <div style={{
                    flex: 1, textAlign: "center", background: "rgba(99,102,241,.08)",
                    border: "1px solid rgba(99,102,241,.2)", borderRadius: 12, padding: "16px 8px",
                  }}>
                    <div style={{ fontSize: "2rem", fontWeight: 900, color: "#818cf8" }}>{friendData.total_points ?? 0}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: 4 }}>{t("compare.friend")}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.6)", marginTop: 2, fontWeight: 700 }}>
                      {friendData.display_name || t("compare.friend")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Match-by-match comparison */}
            {allMatchIds.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">🎯</div>
                <h3>{t("compare.noGradedYet")}</h3>
                <p>{t("compare.predictBeforeKickoff")}</p>
                <Link to="/scores/today" style={{ color: "var(--accent)", fontWeight: 700 }}>{t("compare.browseMatches")}</Link>
              </div>
            ) : (
              <div className="widget-next-match">
                <div className="widget-title">
                  <h3>{t("compare.matchResults")}</h3>
                </div>
                <div className="widget-body p-0">
                  {/* Header row */}
                  <div style={{ display: "flex", padding: "8px 16px", borderBottom: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5 }}>
                    <span style={{ flex: 1 }}>{t("table.team")}</span>
                    <span style={{ width: 60, textAlign: "center" }}>{t("compare.you")}</span>
                    {friendData && <span style={{ width: 60, textAlign: "center" }}>{t("compare.friend")}</span>}
                  </div>

                  {allMatchIds.map(matchId => {
                    const mine  = myMap[matchId]
                    const their = friendMap[matchId]

                    return (
                      <div key={matchId} style={{
                        display: "flex", alignItems: "center",
                        padding: "10px 16px", borderBottom: "1px solid var(--border)", gap: 8,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {matchName(matchId)}
                          </div>
                          {mine && (
                            <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 2 }}>
                              {t("compare.predicted", { home: mine.home_guess, away: mine.away_guess })}
                            </div>
                          )}
                        </div>
                        <div style={{ width: 60, display: "flex", justifyContent: "center" }}>
                          {mine ? <PtsBadge pts={mine.points_earned} /> : <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>—</span>}
                        </div>
                        {friendData && (
                          <div style={{ width: 60, display: "flex", justifyContent: "center" }}>
                            {their ? <PtsBadge pts={their.points_earned} /> : <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>—</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
