import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

export function useLocale() {
  const { i18n } = useTranslation()
  const [locale, setLocale] = useState(null)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  )

  useEffect(() => {
    // Skip if user already manually picked a language
    const userPicked = localStorage.getItem("golazo_lang_manual")
    if (userPicked) return

    fetch("/api/v1/locale")
      .then(r => r.json())
      .then(data => {
        setLocale(data)

        // Set timezone from IP geo (more accurate than browser default for VPN users)
        if (data.timezone) setTimezone(data.timezone)

        // Auto-set language only if not already overridden by user
        const saved = localStorage.getItem("golazo_lang")
        if (!saved && data.language) {
          i18n.changeLanguage(data.language)
        }

        // Set HTML lang + dir for RTL support
        applyLangToDocument(i18n.language)
      })
      .catch(() => {
        // Fallback: use browser timezone (already set above)
      })
  }, [])

  // When language changes, update HTML attributes
  useEffect(() => {
    applyLangToDocument(i18n.language)
  }, [i18n.language])

  const changeLanguage = (lang) => {
    localStorage.setItem("golazo_lang", lang)
    localStorage.setItem("golazo_lang_manual", "1")
    i18n.changeLanguage(lang)
  }

  return { locale, timezone, currentLang: i18n.language, changeLanguage }
}

function applyLangToDocument(lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"
}

// Timezone-aware date formatters using the detected timezone
export function useFormatter(timezone) {
  const { i18n } = useTranslation()
  const locale = i18n.language

  return {
    time: (utcDate) => {
      if (!utcDate) return "TBD"
      return new Date(utcDate).toLocaleTimeString(locale, {
        hour: "2-digit", minute: "2-digit",
        timeZone: timezone,
      })
    },
    date: (utcDate) => {
      if (!utcDate) return "TBD"
      return new Date(utcDate).toLocaleDateString(locale, {
        weekday: "short", month: "short", day: "numeric",
        timeZone: timezone,
      })
    },
    dateTime: (utcDate) => {
      if (!utcDate) return "TBD"
      return new Date(utcDate).toLocaleString(locale, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: timezone,
      })
    },
    fullDateTime: (utcDate) => {
      if (!utcDate) return "TBD"
      return new Date(utcDate).toLocaleString(locale, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZoneName: "short",
        timeZone: timezone,
      })
    },
  }
}
