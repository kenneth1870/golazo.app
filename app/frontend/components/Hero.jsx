import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

function Countdown({ targetDate }) {
  const [t, setT] = useState(getLeft(targetDate))
  useEffect(() => {
    const id = setInterval(() => setT(getLeft(targetDate)), 1000)
    return () => clearInterval(id)
  }, [targetDate])
  return (
    <div className="countdown-wrap">
      {[["Days",t.days],["Hours",t.hours],["Mins",t.minutes],["Secs",t.seconds]].map(([l,v])=>(
        <span key={l}><strong>{String(v).padStart(2,"0")}</strong><small>{l}</small></span>
      ))}
    </div>
  )
}

function getLeft(d) {
  const ms = Math.max(0, Date.parse(d) - Date.now())
  return { days:Math.floor(ms/864e5), hours:Math.floor(ms/36e5)%24, minutes:Math.floor(ms/6e4)%60, seconds:Math.floor(ms/1e3)%60 }
}

export default function Hero({ nextMatch }) {
  const navigate = useNavigate()
  return (
    <div className="hero overlay" style={{ backgroundImage:"url('/images/bg_3.jpg')" }}>
      <div className="container">
        <div className="row align-items-center">
          <div className="col-lg-5 ml-auto">
            <h1 className="text-white">Mundial 2026</h1>
            <p>Live scores, real-time stats, and every goal from the FIFA World Cup 2026.</p>
            {nextMatch && (
              <>
                <p style={{ color:"rgba(255,255,255,.6)", fontSize:".8rem", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Next match</p>
                <Countdown targetDate={nextMatch.kickoff_at} />
              </>
            )}
            <p>
              <button className="btn btn-primary py-3 px-4 mr-3" onClick={() => navigate("/scores/live")}>Live Scores</button>
              <button className="btn btn-white py-3 px-4" onClick={() => navigate("/scores/fixtures")} style={{ background:"transparent", border:"2px solid rgba(255,255,255,.4)", color:"#fff" }}>Fixtures</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
