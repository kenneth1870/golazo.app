import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"
import { isIosSafari, isStandalone } from "../utils/platform"

const DISMISSED_KEY    = "golazo_install_dismissed_at"
const DISMISS_TTL_MS   = 30 * 24 * 60 * 60 * 1000 // re-prompt after 30 days

function wasDismissed() {
  // Migrate old permanent flag to timestamped key
  const old = storageGet("golazo_install_dismissed")
  if (old) {
    storageSet(DISMISSED_KEY, Date.now().toString())
    localStorage.removeItem("golazo_install_dismissed")
  }
  const at = parseInt(storageGet(DISMISSED_KEY) || "0", 10)
  return at && Date.now() - at < DISMISS_TTL_MS
}

// ── Android / Chrome install prompt ──────────────────
function AndroidBanner({ onInstall, onDismiss }) {
  const { t } = useTranslation()
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
          {t("install.installApp")}
        </div>
        <div style={{ fontSize: ".75rem", color: "#7d8590", lineHeight: 1.4 }}>
          {t("install.tagline")}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button
          onClick={onInstall}
          style={{
            background: "#ee1e46", color: "#fff", border: "none",
            borderRadius: 7, padding: "7px 14px", fontWeight: 700,
            fontSize: ".78rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {t("install.installApp")}
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "none", color: "#7d8590", border: "none",
            fontSize: ".72rem", cursor: "pointer", fontFamily: "inherit", padding: "2px 0",
          }}
        >
          {t("push.notNow")}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────
// Note: iOS Safari install instructions are handled by IosInstallGuide.jsx.
// This component only handles the Android/Chrome beforeinstallprompt flow.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showAndroid, setShowAndroid]       = useState(false)

  useEffect(() => {
    // iOS Safari is handled by IosInstallGuide — skip here to avoid double prompts
    if (isIosSafari()) return
    if (isStandalone()) return
    if (wasDismissed()) return

    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowAndroid(true), 8000)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  function dismiss() {
    storageSet(DISMISSED_KEY, Date.now().toString())
    setShowAndroid(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") storageSet(DISMISSED_KEY, Date.now().toString())
    setDeferredPrompt(null)
    setShowAndroid(false)
  }

  if (showAndroid) return <AndroidBanner onInstall={install} onDismiss={dismiss} />
  return null
}
