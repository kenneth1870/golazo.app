import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { storageGet } from "../utils/safeStorage"

const DISMISSED_KEY = "golazo_push_dismissed_at"
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000 // re-prompt after 1 day
const ONBOARDING_GRACE_MS = 60 * 60 * 1000

// Shown after a user views the page for a few seconds.
// Asks to enable goal alerts, optionally scoped to a favorite team.
export default function PushPrompt({ favoriteTeamName = null, paused = false }) {
  const { t } = useTranslation()
  const { supported, permission, subscribed, loading, subscribe, needsIosInstall } = usePushNotifications()
  const [visible, setVisible] = useState(false)
  const [done,    setDone]    = useState(false)
  const [errMsg,  setErrMsg]  = useState(null)

  useEffect(() => {
    if (paused) return
    if (!supported && !needsIosInstall) return
    if (permission === "denied") return
    if (subscribed) return
    const onboardedAt = parseInt(storageGet("golazo_onboarded_at") || "0", 10)
    if (onboardedAt && Date.now() - onboardedAt < ONBOARDING_GRACE_MS) return
    // Migrate old permanent flag (value "1") to a timestamped key
    const oldKey = "golazo_push_dismissed"
    if (localStorage.getItem(oldKey)) {
      localStorage.setItem(DISMISSED_KEY, Date.now().toString())
      localStorage.removeItem(oldKey)
    }
    const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) || "0", 10)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return
    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [supported, needsIosInstall, permission, subscribed, paused])

  if (paused || !visible || subscribed || done) return null
  if (permission === "denied") return null

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    setVisible(false)
  }

  const enable = async () => {
    if (needsIosInstall) return // button shouldn't be reachable but guard anyway
    setErrMsg(null)
    const result = await subscribe(favoriteTeamName ? [favoriteTeamName] : [])
    if (result.ok) {
      setDone(true)
      setVisible(false)
    } else if (result.error === "Permission denied") {
      dismiss()
    } else {
      setErrMsg(result.error || t("push.error"))
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
      <span style={{ fontSize: "1.6rem", flexShrink: 0, marginTop: 2 }}>
        {needsIosInstall ? "📲" : "⚽"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", marginBottom: 4 }}>
          {t("push.getAlerts")}
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.6)", marginBottom: 10 }}>
          {needsIosInstall
            ? t("push.iosHint")
            : favoriteTeamName
            ? t("push.teamAlerts", { team: favoriteTeamName })
            : t("push.generalAlerts")}
        </div>

        {errMsg && (
          <div style={{ fontSize: "0.75rem", color: "#f87171", marginBottom: 8 }}>
            ⚠ {errMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          {!needsIosInstall && (
            <button
              onClick={enable}
              disabled={loading}
              style={{
                background: "#ee1e46", color: "#fff", border: "none",
                borderRadius: 8, padding: "7px 14px", fontSize: "0.8rem",
                fontWeight: 700, cursor: loading ? "default" : "pointer",
                opacity: loading ? .6 : 1,
              }}
            >
              {loading ? t("push.enabling") : errMsg ? t("push.retry") : t("push.enable")}
            </button>
          )}
          <button
            onClick={dismiss}
            style={{
              background: "transparent", color: "rgba(255,255,255,.4)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8, padding: "7px 12px", fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            {t("push.notNow")}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: "none", border: "none", color: "rgba(255,255,255,.3)",
          fontSize: "1rem", cursor: "pointer", padding: 0, flexShrink: 0,
        }}
        aria-label={t("a11y.dismiss")}
      >✕</button>
    </div>
  )
}
