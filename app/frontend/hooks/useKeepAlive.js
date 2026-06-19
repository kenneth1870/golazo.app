import { useEffect } from "react"

const INTERVAL_MS = 4 * 60 * 1000 // 4 min — under Render's 15-min sleep threshold

// Pings /up every 4 minutes while the tab is visible so the Render free-plan
// server doesn't spin down mid-session. Fire-and-forget; errors are ignored.
export function useKeepAlive() {
  useEffect(() => {
    const ping = () => { if (!document.hidden) fetch("/up").catch(() => {}) }
    const iv = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(iv)
  }, [])
}
