import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { consentDecided, setConsent } from "../utils/consent"
import { useFocusTrap } from "../hooks/useFocusTrap"
import { claimPrompt, releasePrompt } from "../utils/promptCoordinator"

export default function ConsentBanner({ paused = false }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const panelRef = useFocusTrap(visible)

  useEffect(() => {
    if (consentDecided() || paused) return
    const timer = setTimeout(() => {
      if (claimPrompt("consent")) setVisible(true)
    }, 1500)
    return () => clearTimeout(timer)
  }, [paused])

  useEffect(() => {
    if (visible) {
      document.body.classList.add("has-consent-banner")
    } else {
      document.body.classList.remove("has-consent-banner")
    }
    return () => document.body.classList.remove("has-consent-banner")
  }, [visible])

  useEffect(() => {
    if (paused && visible) {
      releasePrompt("consent")
      setVisible(false)
    }
  }, [paused, visible])

  if (!visible) return null

  function dismissPrompt() {
    releasePrompt("consent")
    setVisible(false)
  }

  const accept = () => {
    setConsent("granted")
    dismissPrompt()
  }

  const decline = () => {
    setConsent("denied")
    dismissPrompt()
  }

  return (
    <div ref={panelRef} className="consent-banner" role="dialog" aria-modal="true" aria-label={t("consent.title")}>
      <div>
        <div className="consent-banner__title">{t("consent.title")}</div>
        <div className="consent-banner__message">{t("consent.message")}</div>
      </div>
      <div className="consent-banner__actions">
        <button type="button" className="consent-banner__accept" onClick={accept}>
          {t("consent.accept")}
        </button>
        <button type="button" className="consent-banner__decline" onClick={decline}>
          {t("consent.decline")}
        </button>
      </div>
    </div>
  )
}
