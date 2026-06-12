import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"

function getLeft(d) {
  const ms = Math.max(0, Date.parse(d) - Date.now())
  return { days: Math.floor(ms / 864e5), hours: Math.floor(ms / 36e5) % 24, minutes: Math.floor(ms / 6e4) % 60, seconds: Math.floor(ms / 1e3) % 60 }
}

const WC_OPENING = "2026-06-11T19:00:00Z"

const BG_IMAGES = [
  "/images/hero_1.jpg",   // stadium aerial at night
  "/images/hero_2.jpg",   // players on pitch wide angle
  "/images/hero_3.jpg",   // packed stadium crowd
  "/images/hero_4.jpg",   // football on green grass
  "/images/hero_5.jpg",   // stadium floodlights at dusk
  "/images/hero_6.jpg",   // goalkeeper action shot
]

function randomBg() {
  return BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)]
}

function Countdown({ targetDate, label }) {
  const [left, setLeft] = useState(getLeft(targetDate))
  useEffect(() => {
    const id = setInterval(() => setLeft(getLeft(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])

  const isOver = Object.values(left).every(v => v === 0)
  if (isOver) return null

  return (
    <div style={{ marginBottom: 24 }}>
      {label && (
        <p style={{ fontSize: ".68rem", color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 10 }}>
          {label}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[["days", left.days], ["hr", left.hours], ["min", left.minutes], ["sec", left.seconds]].map(([l, v]) => (
          <span key={l} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{
              display: "inline-block",
              background: "rgba(238,30,70,.18)",
              border: "1px solid rgba(238,30,70,.35)",
              padding: "8px 14px", borderRadius: 8,
              fontWeight: 900, fontSize: "1.5rem", color: "#fff",
              minWidth: 52, textAlign: "center", fontVariantNumeric: "tabular-nums",
            }}>
              {String(v).padStart(2, "0")}
            </span>
            <span style={{ fontSize: ".6rem", color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 4 }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Feature pills shown in the hero
const FEATURES = [
  { icon: "🔴", label: "Live Scores" },
  { icon: "📊", label: "Match Stats" },
  { icon: "🏆", label: "Standings" },
  { icon: "👥", label: "Teams" },
  { icon: "👤", label: "Players" },
  { icon: "🔔", label: "Goal Alerts" },
  { icon: "🗞️", label: "News" },
]

// Pick a random index that differs from the current one
function nextBgIdx(current) {
  if (BG_IMAGES.length <= 1) return 0
  let idx
  do { idx = Math.floor(Math.random() * BG_IMAGES.length) } while (idx === current)
  return idx
}

export default function Hero({ nextMatch, liveCount = 0 }) {
  const navigate   = useNavigate()
  const { t }      = useTranslation()
  const target     = nextMatch?.kickoff_at || WC_OPENING

  // Two layers: "current" visible, "next" hidden. We cross-fade by toggling activeLayer.
  const [idxA, setIdxA]      = useState(0)
  const [idxB, setIdxB]      = useState(1)
  const [activeLayer, setActiveLayer] = useState("a")   // "a" | "b"
  const currentIdxRef   = useRef(0)
  const activeLayerRef  = useRef("a")   // mirror of activeLayer for stable interval closure

  useEffect(() => {
    const iv = setInterval(() => {
      const newIdx = nextBgIdx(currentIdxRef.current)
      currentIdxRef.current = newIdx
      if (activeLayerRef.current === "a") {
        setIdxB(newIdx)
        activeLayerRef.current = "b"
        setActiveLayer("b")
      } else {
        setIdxA(newIdx)
        activeLayerRef.current = "a"
        setActiveLayer("a")
      }
    }, 7000)
    return () => clearInterval(iv)
  }, [])  // runs once — refs keep the closure fresh

  const isOpening  = !nextMatch?.kickoff_at
  const countdownLabel = isOpening
    ? t("hero.opensIn")
    : `${t("hero.nextMatch")}: ${nextMatch.home_team?.name ?? ""} vs ${nextMatch.away_team?.name ?? ""}`

  const bgStyle = {
    position: "absolute", inset: 0,
    backgroundSize: "cover", backgroundPosition: "center 30%",
    transition: "opacity 1.2s ease",
  }
  const overlayStyle = {
    position: "absolute", inset: 0, pointerEvents: "none",
    background: "linear-gradient(160deg, rgba(6,8,16,.78) 0%, rgba(10,14,24,.65) 40%, rgba(8,12,20,.55) 70%, rgba(6,8,14,.72) 100%)",
  }

  return (
    <div style={{
      position: "relative",
      borderBottom: "1px solid rgba(255,255,255,.06)",
      overflow: "hidden",
    }}>
      {/* Background layer A */}
      <div aria-hidden="true" style={{
        ...bgStyle,
        backgroundImage: `url('${BG_IMAGES[idxA]}')`,
        opacity: activeLayer === "a" ? 1 : 0,
      }} />
      {/* Background layer B */}
      <div aria-hidden="true" style={{
        ...bgStyle,
        backgroundImage: `url('${BG_IMAGES[idxB]}')`,
        opacity: activeLayer === "b" ? 1 : 0,
      }} />
      {/* Dark overlay — keeps text readable over any photo */}
      <div aria-hidden="true" style={overlayStyle} />
      {/* Accent glow + subtle grid */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          radial-gradient(ellipse 60% 55% at 85% 50%, rgba(238,30,70,.08) 0%, transparent 65%),
          repeating-linear-gradient(90deg, transparent, transparent 99px, rgba(255,255,255,.018) 100px)
        `,
      }} />

      <div className="container" style={{ position: "relative", padding: "60px 15px 52px" }}>
        <div className="row align-items-center">
          <div className="col-12 col-lg-7">

            {/* Live badge */}
            {liveCount > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(238,30,70,.15)", border: "1px solid rgba(238,30,70,.4)",
                  borderRadius: 20, padding: "4px 12px",
                  fontSize: ".68rem", fontWeight: 800, color: "#ee1e46", letterSpacing: ".08em", textTransform: "uppercase",
                }}>
                  <span className="live-dot" />
                  {liveCount} {liveCount === 1 ? "match" : "matches"} live now
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 20, padding: "4px 12px",
                  fontSize: ".68rem", fontWeight: 700, color: "rgba(255,255,255,.55)", letterSpacing: ".06em",
                }}>
                  ⚽ {t("hero.badge", "FIFA World Cup 2026 · Live Coverage")}
                </span>
              </div>
            )}

            {/* Headline */}
            <h1 style={{
              fontSize: "clamp(1.7rem, 5.5vw, 2.8rem)",
              fontWeight: 900, color: "#fff", lineHeight: 1.15,
              margin: "0 0 12px", letterSpacing: "-.01em",
            }}>
              {t("hero.title")}
            </h1>

            <p style={{
              fontSize: "clamp(.85rem, 2.5vw, 1rem)",
              color: "rgba(255,255,255,.65)",
              margin: "0 0 24px",
              maxWidth: 520,
              lineHeight: 1.55,
            }}>
              {t("hero.subtitle")}
            </p>

            {/* Countdown */}
            <Countdown targetDate={target} label={countdownLabel} />

            {/* CTAs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/scores/today")}
              >
                {liveCount > 0 ? t("hero.liveBtn") : t("hero.todayBtn", "Today's Matches")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/mundial")}
              >
                🏆 {t("nav.mundial", "World Cup 2026")}
              </button>
            </div>

            {/* Feature proof chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FEATURES.map(f => (
                <span key={f.label} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 6, padding: "4px 10px",
                  fontSize: ".65rem", fontWeight: 600, color: "rgba(255,255,255,.65)",
                }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
