import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { getDeviceId } from "../utils/deviceId"
import i18n from "../i18n"

const HEARTBEAT_MS = 60_000 // must stay under the server's CONTINUOUS_GAP (90s)

// Fire-and-forget usage heartbeat. Pings on mount, on each route change, and
// every 60s while the tab is visible. Pauses when the tab is hidden so we only
// accumulate real foreground engagement time.
export function useAnalytics() {
  const location = useLocation()
  const pathRef  = useRef(location.pathname)
  pathRef.current = location.pathname

  const ping = () => {
    if (typeof document !== "undefined" && document.hidden) return
    const body = JSON.stringify({
      device_id: getDeviceId(),
      path:      pathRef.current,
      locale:    i18n.language,
    })
    // sendBeacon survives page unload; fall back to fetch with keepalive.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/v1/track", new Blob([body], { type: "application/json" }))
    } else {
      fetch("/api/v1/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {})
    }
  }

  // Ping on every route change (also fires once on mount).
  useEffect(() => { ping() }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat while visible + flush on hide/unload.
  useEffect(() => {
    const iv = setInterval(ping, HEARTBEAT_MS)
    const onVisible = () => { if (!document.hidden) ping() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pagehide", ping)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pagehide", ping)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
