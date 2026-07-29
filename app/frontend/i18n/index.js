import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { storageGet } from "../utils/safeStorage"

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "es", label: "Español", flag: "🇲🇽", dir: "ltr" },
]

const SUPPORTED = ["en", "es"]
const loaders = {
  en: () => import("./locales/en.json"),
  es: () => import("./locales/es.json"),
}

const savedLang   = storageGet("golazo_lang")
const initialLang = savedLang || "es"

async function loadBundle(lang) {
  const mod = await loaders[lang]()
  if (!i18n.hasResourceBundle(lang, "translation")) {
    i18n.addResourceBundle(lang, "translation", mod.default)
  }
}

export const initPromise = loaders[initialLang]()
  .then(mod => {
    i18n
      .use(initReactI18next)
      .init({
        resources: { [initialLang]: { translation: mod.default } },
        lng: initialLang,
        fallbackLng: "es",
        supportedLngs: SUPPORTED,
        interpolation: { escapeValue: false },
      })
    return i18n
  })

/** Load a locale bundle on demand (used by language switcher). */
export async function ensureLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return
  await loadBundle(lang)
  await i18n.changeLanguage(lang)
}

export default i18n
