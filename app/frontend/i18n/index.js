import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

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

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, es: { translation: es }, pt: { translation: pt }, fr: { translation: fr }, de: { translation: de }, ar: { translation: ar }, ja: { translation: ja }, ko: { translation: ko } },
    fallbackLng: "en",
    supportedLngs: ["en", "es", "pt", "fr", "de", "ar", "ja", "ko"],
    detection: {
      // Order: localStorage override → navigator language → HTML lang
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "golazo_lang",
    },
    interpolation: { escapeValue: false },
  })

export default i18n
