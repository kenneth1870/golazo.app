import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { claimPrompt, releasePrompt } from "../utils/promptCoordinator"
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
    <div className="install-prompt">
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
            background: "var(--accent)", color: "#fff", border: "none",
            borderRadius: 7, padding: "7px 14px", fontWeight: 700,
            fontSize: ".78rem", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {t("install.installApp")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="install-prompt__dismiss focus-brand"
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
export default function InstallPrompt({ paused = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showAndroid, setShowAndroid]       = useState(false)

  useEffect(() => {
    if (paused) return
    // iOS Safari is handled by IosInstallGuide — skip here to avoid double prompts
    if (isIosSafari()) return
    if (isStandalone()) return
    if (wasDismissed()) return
    const onboardedAt = parseInt(storageGet("golazo_onboarded_at") || "0", 10)
    if (onboardedAt && Date.now() - onboardedAt < 60 * 60 * 1000) return

    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => {
        if (claimPrompt("android-install")) setShowAndroid(true)
      }, 12000)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [paused])

  function dismiss() {
    releasePrompt("android-install")
    storageSet(DISMISSED_KEY, Date.now().toString())
    setShowAndroid(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") storageSet(DISMISSED_KEY, Date.now().toString())
    releasePrompt("android-install")
    setDeferredPrompt(null)
    setShowAndroid(false)
  }

  if (showAndroid) return <AndroidBanner onInstall={install} onDismiss={dismiss} />
  return null
}
