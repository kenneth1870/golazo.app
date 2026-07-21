import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"
import { isIosSafari, isStandalone } from "../utils/platform"

const SHOWN_KEY = "golazo_ios_guide_shown"

const STEPS = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/>
        <line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
    ),
    labelKey: "ios.step1",
    defaultLabel: 'Tap the Share button',
    descKey: "ios.step1Desc",
    defaultDesc: 'at the bottom of Safari',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ),
    labelKey: "ios.step2",
    defaultLabel: 'Tap "Add to Home Screen"',
    descKey: "ios.step2Desc",
    defaultDesc: 'scroll down in the share sheet',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
    labelKey: "ios.step3",
    defaultLabel: 'Tap "Add"',
    descKey: "ios.step3Desc",
    defaultDesc: "then open Golazo from your home screen",
  },
]

export default function IosInstallGuide({ paused = false }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (paused) return
    if (!isIosSafari()) return
    if (isStandalone()) return
    if (storageGet(SHOWN_KEY)) return
    const onboardedAt = parseInt(storageGet("golazo_onboarded_at") || "0", 10)
    if (onboardedAt && Date.now() - onboardedAt < 60 * 60 * 1000) return

    const timer = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(timer)
  }, [paused])

  function dismiss() {
    storageSet(SHOWN_KEY, "1")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,.72)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={dismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          background: "linear-gradient(180deg,#161b27 0%,#0f1219 100%)",
          borderRadius: "22px 22px 0 0",
          border: "1px solid rgba(255,255,255,.08)",
          borderBottom: "none",
          padding: "28px 24px calc(32px + env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 48px rgba(0,0,0,.5)",
          animation: "slideUp .3s ease",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(238,30,70,.15)",
            border: "1px solid rgba(238,30,70,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
          }}>
            <span style={{ fontSize: "1.6rem" }}>⚽</span>
          </div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
            {t("ios.title", "Get the full experience")}
          </h2>
          <p style={{ fontSize: ".82rem", color: "rgba(255,255,255,.55)", margin: 0, lineHeight: 1.5 }}>
            {t("ios.subtitle", "Add Golazo to your home screen to enable live goal alerts and faster access.")}
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 26 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: "rgba(255,255,255,.06)",
                border: "1px solid rgba(255,255,255,.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--accent)",
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: ".88rem", fontWeight: 700, color: "#fff" }}>
                  {t(step.labelKey, step.defaultLabel)}
                </div>
                <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.45)", marginTop: 2 }}>
                  {t(step.descKey, step.defaultDesc)}
                </div>
              </div>
              <div style={{
                marginLeft: "auto", flexShrink: 0,
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(238,30,70,.15)",
                border: "1px solid rgba(238,30,70,.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".65rem", fontWeight: 800, color: "var(--accent)",
              }}>
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Arrow pointing down toward Safari toolbar */}
        <div style={{
          position: "absolute", bottom: "calc(8px + env(safe-area-inset-bottom))",
          left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        }}>
          <span style={{ fontSize: ".65rem", color: "rgba(255,255,255,.3)", letterSpacing: ".06em", textTransform: "uppercase" }}>
            {t("ios.tapShare", "Tap Share below")}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,.3)">
            <path d="M12 16l-6-6h12z"/>
          </svg>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={dismiss}
            style={{
              width: "100%", padding: "14px", borderRadius: 12,
              background: "var(--accent)", border: "none",
              color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
            }}
          >
            {t("ios.gotIt", "Got it!")}
          </button>
          <button
            onClick={dismiss}
            style={{
              width: "100%", padding: "10px", borderRadius: 12,
              background: "none", border: "none",
              color: "rgba(255,255,255,.35)", fontSize: ".82rem", cursor: "pointer",
            }}
          >
            {t("ios.later", "Remind me later")}
          </button>
        </div>
      </div>
    </div>
  )
}
