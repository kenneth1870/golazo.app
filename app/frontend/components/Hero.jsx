import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function getLeft(d) {
  const ms = Math.max(0, Date.parse(d) - Date.now())
  return { weeks: Math.floor(ms / 6048e5), days: Math.floor(ms / 864e5) % 7, hours: Math.floor(ms / 36e5) % 24, minutes: Math.floor(ms / 6e4) % 60, seconds: Math.floor(ms / 1e3) % 60 }
}

function Countdown({ targetDate }) {
  const [t, setT] = useState(getLeft(targetDate))
  useEffect(() => {
    const id = setInterval(() => setT(getLeft(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])
  return (
    <div className="mb-4">
      {[["wks", t.weeks], ["days", t.days], ["hr", t.hours], ["min", t.minutes], ["sec", t.seconds]].map(([l, v]) => (
        <span key={l} className="countdown-block" style={{ marginRight: 6, display: "inline-block" }}>
          <span className="label" style={{ display: "inline-block", background: "rgba(255,255,255,.1)", padding: "6px 14px", borderRadius: 4, fontWeight: 900, fontSize: "1.4rem", color: "#fff", minWidth: 50, textAlign: "center" }}>
            {String(v).padStart(2, "0")}
          </span>
          <span style={{ display: "block", fontSize: ".65rem", color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: 1, marginTop: 4, textAlign: "center" }}>{l}</span>
        </span>
      ))}
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
            {nextMatch && <Countdown targetDate={nextMatch.kickoff_at} />}
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
