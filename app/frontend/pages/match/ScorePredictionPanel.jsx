import { useState, useEffect } from "react"

const DEVICE_KEY = "golazo_device_id"

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

const POINTS_LABEL = { 3: "⭐ Exact!", 1: "✓ Correct", 0: "✗ Wrong" }

export default function ScorePredictionPanel({ matchId, homeName, awayName, matchStatus, t }) {
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
      setError("Enter valid scores (0–29)")
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
      if (data.error) setError(data.error)
      else setMyPred(data)
    } catch {
      setError("Could not save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!loaded || (!canPredict && !myPred && !isFinished)) return null

  return (
    <section className="match-section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="match-section__title" style={{ margin: 0 }}>🎯 Score Prediction</h3>
        {myPred?.points_earned != null && (
          <span style={{
            background: myPred.points_earned === 3 ? "rgba(16,185,129,.2)" : myPred.points_earned === 1 ? "rgba(245,158,11,.2)" : "rgba(239,68,68,.15)",
            color: myPred.points_earned === 3 ? "#10b981" : myPred.points_earned === 1 ? "#f59e0b" : "#ef4444",
            border: `1px solid currentColor`, borderRadius: 20, padding: "3px 12px",
            fontSize: "0.75rem", fontWeight: 700,
          }}>
            {POINTS_LABEL[myPred.points_earned]} +{myPred.points_earned}pts
          </span>
        )}
      </div>

      {myPred ? (
        /* Already predicted — show their guess */
        <div style={{
          background: "var(--surface2)", borderRadius: 10, padding: "16px 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        }}>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{homeName}</span>
          <span style={{
            fontWeight: 900, fontSize: "1.4rem", color: "#fff",
            background: "rgba(255,255,255,.07)", padding: "4px 16px", borderRadius: 6,
            letterSpacing: 2,
          }}>
            {myPred.home_guess} – {myPred.away_guess}
          </span>
          <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{awayName}</span>
        </div>
      ) : canPredict ? (
        /* Input form */
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
                borderRadius: 8, color: "#fff",
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
                borderRadius: 8, color: "#fff",
              }}
            />
            <span style={{ fontSize: "0.82rem", color: "var(--muted)", flex: 1 }}>{awayName}</span>
          </div>
          {error && <p style={{ color: "#ef4444", fontSize: "0.75rem", textAlign: "center", margin: "0 0 8px" }}>{error}</p>}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={submit} disabled={saving}
              style={{
                background: "#ee1e46", color: "#fff", border: "none",
                borderRadius: 8, padding: "9px 28px", fontWeight: 700,
                fontSize: "0.85rem", cursor: "pointer", opacity: saving ? .6 : 1,
              }}
            >
              {saving ? "Saving…" : "Predict score · 3pts exact / 1pt result"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.82rem", textAlign: "center" }}>
          Predictions locked — match has {isLive ? "started" : "ended"}
        </p>
      )}
    </section>
  )
}
