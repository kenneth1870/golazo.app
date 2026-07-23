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
    <div className="consent-banner" role="dialog" aria-label={t("consent.title")}>
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
