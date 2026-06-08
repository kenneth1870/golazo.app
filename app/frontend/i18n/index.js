import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import es from "./locales/es.json"

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "es", label: "Español", flag: "🇲🇽", dir: "ltr" },
]

const SUPPORTED = ["en", "es"]

// Priority: 1) user-saved preference  2) device/browser language  3) English
const savedLang  = localStorage.getItem("golazo_lang")
const deviceLang = (navigator.language || navigator.userLanguage || "en").split("-")[0].toLowerCase()
const initialLang = savedLang || (SUPPORTED.includes(deviceLang) ? deviceLang : "en")

i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es } },
    lng: initialLang,
    fallbackLng: "en",
    supportedLngs: SUPPORTED,
    interpolation: { escapeValue: false },
  })

export default i18n
