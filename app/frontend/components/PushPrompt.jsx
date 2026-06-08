import { useState, useEffect } from "react"
import { usePushNotifications } from "../hooks/usePushNotifications"

const DISMISSED_KEY = "golazo_push_dismissed"

// Shown once per session after a user has viewed Today for 3 seconds.
// Asks to enable goal alerts, optionally scoped to a favorite team.
export default function PushPrompt({ favoriteTeamName = null }) {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()
  const [visible,   setVisible]   = useState(false)
  const [done,      setDone]      = useState(false)

  useEffect(() => {
    if (!supported) return
    if (permission === "denied") return
    if (subscribed) return
    const dismissed = sessionStorage.getItem(DISMISSED_KEY)
    if (dismissed) return
    // Show after 3 s so it doesn't feel jarring
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [supported, permission, subscribed])

  if (!supported || !visible || subscribed || done) return null
  if (permission === "denied") return null

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1")
    setVisible(false)
  }

  const enable = async () => {
    const teams = favoriteTeamName ? [favoriteTeamName] : []
    const result = await subscribe(teams)
    if (result.ok) {
      setDone(true)
      setVisible(false)
    } else if (result.error === "Permission denied") {
      dismiss()
    }
  }

  return (
    <div style={{
      position: "fixed", bottom: 72, left: 12, right: 12, zIndex: 900,
      background: "linear-gradient(135deg,#1a1a2e,#16213e)",
      border: "1px solid rgba(238,30,70,.35)",
      borderRadius: 14, padding: "14px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,.55)",
      display: "flex", alignItems: "flex-start", gap: 12,
      animation: "slideUp .3s ease",
    }}>
      <span style={{ fontSize: "1.6rem", flexShrink: 0, marginTop: 2 }}>⚽</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", marginBottom: 4 }}>
          Get goal alerts
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.6)", marginBottom: 10 }}>
          {favoriteTeamName
            ? `Get notified when ${favoriteTeamName} scores — even with the app closed.`
            : "Get notified when goals are scored — even with the app closed."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={enable}
            disabled={loading}
            style={{
              background: "#ee1e46", color: "#fff", border: "none",
              borderRadius: 8, padding: "7px 14px", fontSize: "0.8rem",
              fontWeight: 700, cursor: "pointer", opacity: loading ? .6 : 1,
            }}
          >
            {loading ? "Enabling…" : "Enable alerts"}
          </button>
          <button
            onClick={dismiss}
            style={{
              background: "transparent", color: "rgba(255,255,255,.4)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8, padding: "7px 12px", fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: "none", border: "none", color: "rgba(255,255,255,.3)",
          fontSize: "1rem", cursor: "pointer", padding: 0, flexShrink: 0,
        }}
        aria-label="Dismiss"
      >✕</button>
    </div>
  )
}
