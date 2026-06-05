import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

function getLeft(d) {
  const ms = Math.max(0, Date.parse(d) - Date.now())
  return { weeks: Math.floor(ms / 6048e5), days: Math.floor(ms / 864e5) % 7, hours: Math.floor(ms / 36e5) % 24, minutes: Math.floor(ms / 6e4) % 60, seconds: Math.floor(ms / 1e3) % 60 }
}

// Opening match: Mexico vs South Africa, June 11 2026 — 19:00 UTC (Estadio Azteca)
const WC_OPENING = "2026-06-11T19:00:00Z"

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
        {[["wks", t.weeks, true], ["days", t.days, false], ["hr", t.hours, false], ["min", t.minutes, false], ["sec", t.seconds, false]].map(([l, v, mobileHide]) => (
          <span key={l} className={mobileHide ? "hero-countdown__wks" : undefined} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <span className="hero-countdown-block" style={{ display: "inline-block", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.15)", padding: "8px 14px", borderRadius: 6, fontWeight: 900, fontSize: "1.6rem", color: "#fff", minWidth: 54, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
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
  const { t } = useTranslation()

  const target    = nextMatch?.kickoff_at || WC_OPENING
  const isOpening = !nextMatch?.kickoff_at
  const label     = isOpening
    ? t("hero.opensIn")
    : `${t("hero.nextMatch")}: ${nextMatch.home_team?.name ?? ""} vs ${nextMatch.away_team?.name ?? ""}`

  return (
    <div className="hero overlay" style={{ backgroundImage: "url('/images/bg_3.jpg')" }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-12 col-lg-6 ml-auto" style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
            <h1 className="text-white" style={{ fontSize: "clamp(1.8rem, 6vw, 3rem)" }}>{t("hero.title")}</h1>
            <p style={{ fontSize: "clamp(.82rem, 2.5vw, 1rem)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {t("hero.subtitle")}
            </p>
            <Countdown targetDate={target} label={label} />
            <p style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <a href="#" className="btn btn-primary py-2 px-4"
                onClick={e => { e.preventDefault(); navigate("/scores/today") }}>
                {t("hero.liveBtn")}
              </a>
              <a href="#" className="btn btn-primary py-2 px-4"
                onClick={e => { e.preventDefault(); navigate("/mundial/schedule") }}
                style={{ background: "transparent", borderColor: "rgba(255,255,255,.4)" }}>
                {t("nav.schedule")}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
