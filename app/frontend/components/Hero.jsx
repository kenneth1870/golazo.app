import { useState, useEffect } from "react"

function Countdown({ targetDate }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate))

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className="countdown-wrap mb-4">
      {[
        { label: "Days", value: timeLeft.days },
        { label: "Hours", value: timeLeft.hours },
        { label: "Mins", value: timeLeft.minutes },
        { label: "Secs", value: timeLeft.seconds },
      ].map(({ label, value }) => (
        <span key={label}>
          <strong>{String(value).padStart(2, "0")}</strong>
          <small>{label}</small>
        </span>
      ))}
    </div>
  )
}

function getTimeLeft(targetDate) {
  const total = Math.max(0, Date.parse(targetDate) - Date.now())
  return {
    days:    Math.floor(total / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / 1000 / 60) % 60),
    seconds: Math.floor((total / 1000) % 60),
  }
}

export default function Hero({ nextMatch, onMatchSelect }) {
  return (
    <div className="hero overlay" style={{ backgroundImage: "url('/images/bg_3.jpg')" }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-5 ml-auto">
            <h1 className="text-white">Mundial 2026</h1>
            <p>Live scores, real-time stats, and every goal from the FIFA World Cup 2026.</p>
            {nextMatch && (
              <>
                <p className="mb-2" style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: 1 }}>
                  Next match
                </p>
                <Countdown targetDate={nextMatch.kickoff_at} />
                <p>
                  <button
                    className="btn btn-primary py-3 px-4"
                    onClick={() => onMatchSelect(nextMatch.id)}
                  >
                    View Match
                  </button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
