import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { getDeviceId } from "../utils/deviceId"
import { hasAnalyticsConsent } from "../utils/consent"
import i18n from "../i18n"

const HEARTBEAT_MS = 60_000 // must stay under the server's CONTINUOUS_GAP (90s)

// Fire-and-forget usage heartbeat. No-op until the user has granted analytics
// consent and only while the tab is visible, so we accumulate real foreground
// engagement from opted-in users.
export function sendAnalyticsPing(path) {
  if (typeof document !== "undefined" && document.hidden) return
  if (!hasAnalyticsConsent()) return
  const body = JSON.stringify({
    device_id: getDeviceId(),
    path:      path || (typeof location !== "undefined" ? location.pathname : "/"),
    locale:    i18n.language,
  })
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/v1/track", new Blob([body], { type: "application/json" }))
  } else {
    fetch("/api/v1/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {})
  }
}

export function useAnalytics() {
  const location = useLocation()
  const pathRef  = useRef(location.pathname)
  pathRef.current = location.pathname

  // Ping on every route change (also fires once on mount).
  useEffect(() => { sendAnalyticsPing(pathRef.current) }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat while visible, flush on hide/unload, and fire right after the
  // user grants consent (so we don't wait up to 60s for the first ping).
  useEffect(() => {
    const beat      = () => sendAnalyticsPing(pathRef.current)
    const iv        = setInterval(beat, HEARTBEAT_MS)
    const onVisible = () => { if (!document.hidden) beat() }
    const onConsent = (e) => { if (e.detail === "granted") beat() }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pagehide", beat)
    window.addEventListener("golazo:consent", onConsent)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pagehide", beat)
      window.removeEventListener("golazo:consent", onConsent)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
