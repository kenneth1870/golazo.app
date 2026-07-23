import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { storageGet, storageSet } from "../../utils/safeStorage"

const DEVICE_KEY = "golazo_device_id"

function useKickoffCountdown(kickoffAt) {
  const [text, setText] = useState("")
  useEffect(() => {
    if (!kickoffAt) return
    const update = () => {
      const ms = Date.parse(kickoffAt) - Date.now()
      if (ms <= 0 || ms > 24 * 3600000) { setText(""); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      // Under 5 minutes: show seconds so the form closes exactly at kickoff
      setText(h > 0 ? `${h}h ${m}m` : m > 4 ? `${m}m` : `${m}:${String(s).padStart(2, "0")}`)
    }
    update()
    // 1-second tick: ensures the panel closes exactly at kickoff, no window of
    // post-kickoff submissions. Cost is negligible (one Date.parse() per second).
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [kickoffAt])
  return text
}

function getDeviceId() {
  let id = storageGet(DEVICE_KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
    storageSet(DEVICE_KEY, id)
  }
  return id
}

function pointsLabel(pts, t) {
  if (pts === 3) return t("prediction.exact")
  if (pts === 1) return t("prediction.correct")
  return t("prediction.wrong")
}

function predictionErrorMessage(code, t) {
  const key = {
    match_already_started: "prediction.errorMatchStarted",
    match_already_graded: "prediction.errorMatchGraded",
    "device_id required": "prediction.errorDeviceRequired",
  }[code]
  return key ? t(key) : code
}

export default function ScorePredictionPanel({ matchId, homeName, awayName, matchStatus, kickoffAt, t }) {
  const [myPred, setMyPred]     = useState(null)   // { home_guess, away_guess, points_earned }
  const [homeVal, setHomeVal]   = useState("")
  const [awayVal, setAwayVal]   = useState("")
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [loaded, setLoaded]     = useState(false)

  const deviceId = getDeviceId()
  const isFinished = matchStatus === "FT" || matchStatus === "AET" || matchStatus === "PEN"
  const isLive     = !["NS", "FT", "AET", "PEN", "CANC", "PST", "ABD"].includes(matchStatus)
  const canPredict = matchStatus === "NS"   // only before kickoff
  const kickoffCountdown = useKickoffCountdown(canPredict ? kickoffAt : null)

  useEffect(() => {
    if (!matchId) return
    fetch(`/api/v1/score_predictions/${matchId}?device_id=${deviceId}`)
      .then(r => r.json())
      .then(d => {
        if (!d.none) {
          setMyPred(d)
          setHomeVal(String(d.home_guess))
          setAwayVal(String(d.away_guess))
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [matchId])

  async function submit() {
    const h = parseInt(homeVal)
    const a = parseInt(awayVal)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError(t("prediction.invalidScore"))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/score_predictions/${matchId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "",
        },
        body: JSON.stringify({
          device_id:      deviceId,
          home_guess:     h,
          away_guess:     a,
          home_team_name: homeName,
          away_team_name: awayName,
        }),
      })
      const data = await res.json()
      if (data.error) setError(predictionErrorMessage(data.error, t))
      else setMyPred(data)
    } catch {
      setError(t("error.dataUnavailable"))
    } finally {
      setSaving(false)
    }
  }

  if (!loaded || (!canPredict && !myPred && !isFinished)) return null

  return (
    <section className="match-section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="match-section__title" style={{ margin: 0 }}>{t("prediction.title")}</h3>
        {kickoffCountdown && canPredict && !myPred && (
          <span style={{ fontSize: "0.68rem", color: "#f59e0b", fontWeight: 600, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, padding: "2px 8px" }}>
            ⏱ {t("prediction.closesIn", { time: kickoffCountdown })}
          </span>
        )}
        {myPred?.points_earned != null && (
          <span style={{
            background: myPred.points_earned === 3 ? "rgba(16,185,129,.2)" : myPred.points_earned === 1 ? "rgba(245,158,11,.2)" : "rgba(239,68,68,.15)",
            color: myPred.points_earned === 3 ? "var(--green)" : myPred.points_earned === 1 ? "var(--amber)" : "var(--danger)",
            border: `1px solid currentColor`, borderRadius: 20, padding: "3px 12px",
            fontSize: "0.75rem", fontWeight: 700,
          }}>
            {pointsLabel(myPred.points_earned, t)} +{myPred.points_earned}pts
          </span>
        )}
      </div>

      {myPred ? (
        <>
          <div style={{
            background: "var(--surface2)", borderRadius: 10, padding: "16px 20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{homeName}</span>
            <span style={{
              fontWeight: 900, fontSize: "1.4rem", color: "var(--text)",
              background: "var(--surface)", padding: "4px 16px", borderRadius: 6,
              letterSpacing: 2,
            }}>
              {myPred.home_guess} – {myPred.away_guess}
            </span>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{awayName}</span>
          </div>
          <p style={{ textAlign: "center", marginTop: 12, marginBottom: 0 }}>
            <Link to="/leaderboard" style={{ color: "var(--accent)", fontSize: "0.78rem", fontWeight: 700 }}>
              {t("prediction.viewLeaderboard", "See the leaderboard →")}
            </Link>
          </p>
        </>
      ) : canPredict ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1, textAlign: "right" }}>{homeName}</span>
            <input
              type="number" min="0" max="29" value={homeVal}
              onChange={e => setHomeVal(e.target.value)}
              placeholder="0"
              style={{
                width: 52, height: 44, textAlign: "center", fontSize: "1.3rem", fontWeight: 900,
                background: "var(--surface2)", border: "2px solid var(--border)",
                borderRadius: 8, color: "var(--text)",
              }}
            />
            <span style={{ fontWeight: 700, color: "var(--muted)" }}>–</span>
            <input
              type="number" min="0" max="29" value={awayVal}
              onChange={e => setAwayVal(e.target.value)}
              placeholder="0"
              style={{
                width: 52, height: 44, textAlign: "center", fontSize: "1.3rem", fontWeight: 900,
                background: "var(--surface2)", border: "2px solid var(--border)",
                borderRadius: 8, color: "var(--text)",
              }}
            />
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1 }}>{awayName}</span>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", textAlign: "center", margin: "0 0 8px" }}>{error}</p>}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={submit} disabled={saving}
              style={{
                background: "var(--accent)", color: "#fff", border: "none",
                borderRadius: 8, padding: "9px 28px", fontWeight: 700,
                fontSize: "0.85rem", cursor: "pointer", opacity: saving ? .6 : 1,
              }}
            >
              {saving ? t("prediction.saving") : t("prediction.submitLabel")}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", textAlign: "center" }}>
          {isLive ? t("prediction.lockedStarted") : t("prediction.lockedEnded")}
        </p>
      )}
    </section>
  )
}
