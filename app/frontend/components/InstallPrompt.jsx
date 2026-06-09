import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"

const DISMISSED_KEY = "golazo_install_dismissed"

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

function isIOSSafari() {
  // Must be iOS and not Chrome/Firefox/Edge on iOS
  return isIOS() && /Safari/.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent)
}

function isStandalone() {
  return window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
}

// ── iOS instruction banner ────────────────────────────
function IOSBanner({ onDismiss }) {
  const { t } = useTranslation()
  return (
    <div style={{
      position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom))",
      left: 12, right: 12, zIndex: 1500,
      background: "#161b22", border: "1px solid rgba(238,30,70,.3)",
      borderRadius: 14, padding: "16px 18px",
      boxShadow: "0 8px 40px rgba(0,0,0,.6)",
      animation: "pageIn .25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: "1.8rem", flexShrink: 0, lineHeight: 1 }}>⚽</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: ".9rem", color: "#fff", marginBottom: 6 }}>
            {t("install.addToHomeScreen")}
          </div>
          <div style={{ fontSize: ".78rem", color: "#7d8590", lineHeight: 1.55 }}>
            Tap{" "}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              background: "rgba(255,255,255,.1)", borderRadius: 5,
              padding: "1px 6px", color: "#e6edf3", fontWeight: 600,
            }}>
              {/* iOS share icon */}
              <svg width="12" height="14" viewBox="0 0 24 28" fill="currentColor">
                <path d="M12 0L6 6h4v12h4V6h4L12 0zM2 20v6h20v-6h-2v4H4v-4H2z"/>
              </svg>
              {t("match.share")}
            </span>
            {" "}then{" "}
            <strong style={{ color: "#e6edf3" }}>{t("install.addToHomeScreen")}</strong>
            {" "}for live scores without the browser.
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none", border: "none", color: "#555",
            fontSize: "1.1rem", cursor: "pointer", padding: "0 0 0 4px", flexShrink: 0, lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Arrow pointing down toward Safari toolbar */}
      <div style={{
        position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
        width: 0, height: 0,
        borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
        borderTop: "10px solid rgba(238,30,70,.3)",
      }} />
    </div>
  )
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
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showAndroid, setShowAndroid]       = useState(false)
  const [showIOS, setShowIOS]               = useState(false)

  useEffect(() => {
    if (storageGet(DISMISSED_KEY)) return
    if (isStandalone()) return

    // iOS Safari: show manual instructions
    if (isIOSSafari()) {
      setTimeout(() => setShowIOS(true), 8000)
      return
    }

    // Android / Chrome: use beforeinstallprompt
    const handler = e => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowAndroid(true), 8000)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  function dismiss() {
    storageSet(DISMISSED_KEY, "1")
    setShowAndroid(false)
    setShowIOS(false)
  }

  async function install() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") storageSet(DISMISSED_KEY, "1")
    setDeferredPrompt(null)
    setShowAndroid(false)
  }

  if (showIOS)     return <IOSBanner onDismiss={dismiss} />
  if (showAndroid) return <AndroidBanner onInstall={install} onDismiss={dismiss} />
  return null
}
