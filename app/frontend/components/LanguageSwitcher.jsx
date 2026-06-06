import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SUPPORTED_LANGUAGES } from "../i18n"

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)

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

  return (
    <div className="lang-switcher" style={{ position: "relative" }}>
      <button
        className="lang-btn"
        onClick={() => setOpen(o => !o)}
        title="Change language"
      >
        <span>{current.flag}</span>
        <span className="lang-code">{current.code.toUpperCase()}</span>
        <span style={{ fontSize: ".6rem", opacity: .6 }}>▾</span>
      </button>

      {open && (
        <>
          <div className="lang-dropdown">
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
