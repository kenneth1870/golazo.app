import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import es from "./locales/es.json"
import pt from "./locales/pt.json"
import fr from "./locales/fr.json"
import de from "./locales/de.json"
import ar from "./locales/ar.json"
import ja from "./locales/ja.json"
import ko from "./locales/ko.json"

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English",    flag: "🇺🇸", dir: "ltr" },
  { code: "es", label: "Español",    flag: "🇲🇽", dir: "ltr" },
  { code: "pt", label: "Português",  flag: "🇧🇷", dir: "ltr" },
  { code: "fr", label: "Français",   flag: "🇫🇷", dir: "ltr" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪", dir: "ltr" },
  { code: "ar", label: "العربية",    flag: "🇸🇦", dir: "rtl" },
  { code: "ja", label: "日本語",      flag: "🇯🇵", dir: "ltr" },
  { code: "ko", label: "한국어",      flag: "🇰🇷", dir: "ltr" },
]

const SUPPORTED = ["en", "es", "pt", "fr", "de", "ar", "ja", "ko"]

// Priority: 1) user-saved preference  2) device/browser language  3) English
const savedLang  = localStorage.getItem("golazo_lang")
const deviceLang = (navigator.language || navigator.userLanguage || "en").split("-")[0].toLowerCase()
const initialLang = savedLang || (SUPPORTED.includes(deviceLang) ? deviceLang : "en")

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, pt: { translation: pt }, fr: { translation: fr }, de: { translation: de }, ar: { translation: ar }, ja: { translation: ja }, ko: { translation: ko } },
    lng: initialLang,
    fallbackLng: "en",
    supportedLngs: SUPPORTED,
    interpolation: { escapeValue: false },
  })

export default i18n
