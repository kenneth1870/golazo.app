import { useState } from "react"
import { useLocale } from "../hooks/useLocale"
import { SUPPORTED_LANGUAGES } from "../i18n"

export default function LanguageSwitcher() {
  const { currentLang, changeLanguage, locale } = useLocale()
  const [open, setOpen] = useState(false)

  const current = SUPPORTED_LANGUAGES.find(l => l.code === currentLang)
    || SUPPORTED_LANGUAGES[0]

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
                onClick={() => { changeLanguage(lang.code); setOpen(false) }}
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

      {/* Show detected country when available */}
      {locale?.flag && (
        <img
          src={locale.flag}
          alt={locale.country}
          title={`Detected: ${locale.city || locale.country} · ${locale.timezone}`}
          style={{ width: 16, height: 11, objectFit: "cover", borderRadius: 2, marginLeft: 4, opacity: .6 }}
        />
      )}
    </div>
  )
}
