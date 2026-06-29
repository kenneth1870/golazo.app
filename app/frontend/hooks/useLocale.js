import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"

export function useLocale() {
  const { i18n } = useTranslation()
  const [locale, setLocale] = useState(null)
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  )

  useEffect(() => {
    // If the user manually overrode the language, respect it — skip IP detection
    if (storageGet("golazo_lang_manual")) return

    fetch("/api/v1/locale")
      .then(r => r.json())
      .then(data => {
        setLocale(data)
        if (data.timezone) setTimezone(data.timezone)
        if (data.language) {
          i18n.changeLanguage(data.language)
          storageSet("golazo_lang", data.language)
          applyLangToDocument(data.language)
        }
      })
      .catch(() => {})
  }, [])

  // When language changes, update HTML attributes
  useEffect(() => {
    applyLangToDocument(i18n.language)
  }, [i18n.language])

  const changeLanguage = (lang) => {
    storageSet("golazo_lang", lang)
    storageSet("golazo_lang_manual", "1")
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
      return new Date(utcDate).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
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
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: timezone,
      })
    },
    fullDateTime: (utcDate) => {
      if (!utcDate) return "TBD"
      return new Date(utcDate).toLocaleString(locale, {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZoneName: "short",
        timeZone: timezone,
      })
    },
  }
}
