import { useState, useEffect } from "react"
import { storageGet, storageSet } from "../../utils/safeStorage"

// Fan-poll panel: shows tap-to-vote buttons, then a results bar chart once the
// visitor has voted (vote persisted in localStorage so it survives reloads).
export default function PredictionPanel({ matchId, homeTeamName, awayTeamName, t }) {
  const [pred, setPred]     = useState(null)
  const [myVote, setMyVote] = useState(null)
  const [voting, setVoting] = useState(false)
  const TOKEN_KEY = `golazo_vote_${matchId}`

  useEffect(() => {
    const saved = storageGet(TOKEN_KEY)
    if (saved) {
      try { setMyVote(JSON.parse(saved).vote) } catch {}
    }
    fetch(`/api/v1/predictions/${matchId}`).then(r => r.json()).then(setPred).catch(() => {})
  }, [matchId])

  function castVote(choice) {
    if (myVote || voting) return
    setVoting(true)
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
    fetch(`/api/v1/predictions/${matchId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.content || "" },
      body: JSON.stringify({ choice, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setPred(data)
          setMyVote(choice)
          storageSet(TOKEN_KEY, JSON.stringify({ vote: choice, token }))
        }
      })
      .catch(() => {})
      .finally(() => setVoting(false))
  }

  if (!pred) return null

  const voted   = !!myVote
  const total   = pred.total || 0
  const options = [
    { key: "home", label: homeTeamName ?? "Home", pct: pred.home_pct, color: "#ee1e46" },
    { key: "draw", label: t("match.draw"),           pct: pred.draw_pct, color: "#f59e0b" },
    { key: "away", label: awayTeamName ?? "Away",  pct: pred.away_pct, color: "#3b82f6" },
  ]

  if (!voted) {
    // Pre-vote: 3 tap buttons
    return (
      <section className="match-section">
        <div className="prediction-header">
          <h3 className="match-section__title" style={{ margin: 0 }}>{t("match.fanPoll")}</h3>
          <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            {total > 0 ? t("match.votes", { count: total }) : t("match.beFirstVote")}
          </span>
        </div>
        <div className="prediction-btns">
          {options.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => castVote(key)}
              disabled={voting}
              className="prediction-btn"
              style={{ "--pred-color": color }}
            >
              <span className="prediction-btn__label">{label}</span>
              <span className="prediction-btn__cta">{t("match.tapToVote")}</span>
            </button>
          ))}
        </div>
      </section>
    )
  }

  // Post-vote: bar chart
  return (
    <section className="match-section">
      <div className="prediction-header">
        <h3 className="match-section__title" style={{ margin: 0 }}>{t("match.fanPoll")}</h3>
        <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{t("match.votes", { count: total })}</span>
      </div>
      <div className="prediction-bars">
        {options.map(({ key, label, pct, color }) => (
          <div key={key} className={`prediction-bar-row${myVote === key ? " prediction-bar-row--mine" : ""}`}>
            <div className="prediction-bar-row__label">
              {label}
              {myVote === key && <span className="prediction-bar-row__you">{t("match.yourVote")}</span>}
            </div>
            <div className="prediction-bar-row__track">
              <div
                className="prediction-bar-row__fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="prediction-bar-row__pct" style={{ color }}>{pct}%</span>
          </div>
        ))}
      </div>
    </section>
  )
}
