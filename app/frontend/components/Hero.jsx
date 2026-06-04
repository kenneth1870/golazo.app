import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function getLeft(d) {
  const ms = Math.max(0, Date.parse(d) - Date.now())
  return { weeks: Math.floor(ms / 6048e5), days: Math.floor(ms / 864e5) % 7, hours: Math.floor(ms / 36e5) % 24, minutes: Math.floor(ms / 6e4) % 60, seconds: Math.floor(ms / 1e3) % 60 }
}

// Opening match: June 11 2026, 8pm ET (midnight UTC)
const WC_OPENING = "2026-06-12T00:00:00Z"

function Countdown({ targetDate, label }) {
  const [t, setT] = useState(getLeft(targetDate))
  useEffect(() => {
    const id = setInterval(() => setT(getLeft(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const isOver = Object.values(t).every(v => v === 0)
  if (isOver) return null

  return (
    <div className="mb-4">
      {label && (
        <p style={{ fontSize: ".72rem", color: "rgba(255,255,255,.55)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
          {label}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[["wks", t.weeks], ["days", t.days], ["hr", t.hours], ["min", t.minutes], ["sec", t.seconds]].map(([l, v]) => (
          <span key={l} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ display: "inline-block", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.15)", padding: "8px 14px", borderRadius: 6, fontWeight: 900, fontSize: "1.6rem", color: "#fff", minWidth: 54, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {String(v).padStart(2, "0")}
            </span>
            <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.45)", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 5 }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Hero({ nextMatch }) {
  const navigate = useNavigate()

  return (
    /* Exact template markup: div.hero.overlay with inline bg */
    <div className="hero overlay" style={{ backgroundImage: "url('/images/bg_3.jpg')" }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-5 ml-auto">
            <h1 className="text-white">Mundial 2026</h1>
            <p>Live scores, real-time stats, and every goal from the FIFA World Cup 2026 — USA · Canada · Mexico.</p>
            {(() => {
              const target = nextMatch?.kickoff_at || WC_OPENING
              const isOpening = !nextMatch?.kickoff_at
              const label = isOpening
                ? "⚽ World Cup opens in"
                : `Next: ${nextMatch.home_team?.name ?? ""} vs ${nextMatch.away_team?.name ?? ""}`
              return <Countdown targetDate={target} label={label} />
            })()}
            <p>
              <a
                href="#"
                className="btn btn-primary py-3 px-4 mr-3"
                onClick={e => { e.preventDefault(); navigate("/scores/live") }}
              >
                Live Scores
              </a>
              <a
                href="#"
                className="btn btn-primary py-3 px-4"
                onClick={e => { e.preventDefault(); navigate("/scores/fixtures") }}
                style={{ background: "transparent", borderColor: "rgba(255,255,255,.4)" }}
              >
                Fixtures
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
