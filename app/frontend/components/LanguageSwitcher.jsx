import { useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES } from "../i18n"

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState("right") // "left" or "right"
  const [dropUp, setDropUp] = useState(false)
  const btnRef = useRef(null)

  const currentLang = i18n.language?.split("-")[0] || "en"
  const current = SUPPORTED_LANGUAGES.find(l => l.code === currentLang)
    || SUPPORTED_LANGUAGES[0]

  function handleSelect(code) {
    // Save as explicit manual override — prevents IP from overriding it next visit
    localStorage.setItem("golazo_lang", code)
    localStorage.setItem("golazo_lang_manual", "1")
    i18n.changeLanguage(code)
    document.documentElement.lang = code
    document.documentElement.dir = code === "ar" ? "rtl" : "ltr"
    setOpen(false)
  }

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setAlign(window.innerWidth - rect.left >= 180 ? "left" : "right")
      // Open upward if less than 180px below the button (footer near bottom nav)
      setDropUp(window.innerHeight - rect.bottom < 180)
    }
    setOpen(o => !o)
  }

  return (
    <div className="lang-switcher" style={{ position: "relative" }}>
      <button
        ref={btnRef}
        className="lang-btn"
        onClick={handleToggle}
        title="Change language"
      >
        <span>{current.flag}</span>
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <span style={{ fontSize: ".6rem", opacity: .6 }}>▾</span>
      </button>

      {open && (
        <>
          <div className="lang-dropdown" style={{ [align]: 0, ...(dropUp ? { bottom: "calc(100% + 6px)", top: "auto" } : {}) }}>
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`lang-option${currentLang === lang.code ? " active" : ""}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-flag">{lang.flag}</span>
                <span className="lang-label">{lang.label}</span>
                {currentLang === lang.code && <span className="lang-check">✓</span>}
              </button>
            ))}
          </div>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
        </>
      )}
    </div>
  )
}
