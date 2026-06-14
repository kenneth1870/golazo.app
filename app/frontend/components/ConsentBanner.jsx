import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { consentDecided, setConsent } from "../utils/consent"

export default function ConsentBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (consentDecided()) return
    const timer = setTimeout(() => setVisible(true), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  const accept = () => {
    setConsent("granted")
    setVisible(false)
  }

  const decline = () => {
    setConsent("denied")
    setVisible(false)
  }

  return (
    <div style={{
      position: "fixed", bottom: "calc(56px + env(safe-area-inset-bottom))", left: 0, right: 0, zIndex: 950,
      background: "#111827",
      borderTop: "1px solid rgba(255,255,255,.1)",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
      boxShadow: "0 -4px 24px rgba(0,0,0,.45)",
      animation: "slideUp .3s ease",
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff", marginBottom: 4 }}>
          {t("consent.title")}
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.55)", lineHeight: 1.5 }}>
          {t("consent.message")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={accept}
          style={{
            background: "#ee1e46", color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 18px", fontSize: "0.82rem",
            fontWeight: 700, cursor: "pointer", flex: 1,
          }}
        >
          {t("consent.accept")}
        </button>
        <button
          onClick={decline}
          style={{
            background: "transparent", color: "rgba(255,255,255,.45)",
            border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 8, padding: "8px 18px", fontSize: "0.82rem",
            cursor: "pointer", flex: 1,
          }}
        >
          {t("consent.decline")}
        </button>
      </div>
    </div>
  )
}
