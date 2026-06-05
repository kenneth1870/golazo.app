import { useState, useEffect } from "react"

const DISMISSED_KEY = "golazo_install_dismissed"

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed or installed
    if (localStorage.getItem(DISMISSED_KEY)) return
    if (window.matchMedia("(display-mode: standalone)").matches) return

    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show after a short delay so it doesn't interrupt page load
      setTimeout(() => setVisible(true), 8000)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1")
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") localStorage.setItem(DISMISSED_KEY, "1")
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible || !deferredPrompt) return null

  return (
    <div style={{
      position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom))", left: 12, right: 12,
      background: "#161b22", border: "1px solid rgba(238,30,70,.3)",
      borderRadius: 14, padding: "16px 18px", zIndex: 1500,
      boxShadow: "0 8px 40px rgba(0,0,0,.6)",
      display: "flex", alignItems: "center", gap: 14,
      animation: "pageIn .25s ease",
    }}>
      <span style={{ fontSize: "2rem", flexShrink: 0 }}>⚽</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#fff", marginBottom: 2 }}>
          Add Golazo to your home screen
        </div>
        <div style={{ fontSize: ".75rem", color: "#7d8590", lineHeight: 1.4 }}>
          Get live scores instantly — no browser needed
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button
          onClick={install}
          style={{
            background: "#ee1e46", color: "#fff", border: "none",
            borderRadius: 7, padding: "7px 14px", fontWeight: 700,
            fontSize: ".78rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Install
        </button>
        <button
          onClick={dismiss}
          style={{
            background: "none", color: "#7d8590", border: "none",
            fontSize: ".72rem", cursor: "pointer", fontFamily: "inherit", padding: "2px 0",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
