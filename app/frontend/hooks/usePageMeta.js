import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAppFocus } from "./useAppFocus"

const DEFAULT_IMAGE = "https://golazo.app/images/icon-512.png"

// Update <title>, <meta name="description">, and all OG/Twitter tags.
// extras: { type, image, site } — optional overrides for og:type / og:image / site suffix
export function usePageMeta(title, description, extras = {}) {
  const { t } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const site = extras.site ?? (clubsPrimary ? t("meta.siteClubs") : t("meta.siteWorldCup"))

  useEffect(() => {
    const fullTitle = title ? `${title} — ${site}` : site
    document.title = fullTitle

    // Helper: find or create a meta tag and set its content
    const setMeta = (selector, attrName, attrVal, content) => {
      if (!content) return
      let tag = document.querySelector(selector)
      if (!tag) {
        tag = document.createElement("meta")
        tag.setAttribute(attrName, attrVal)
        document.head.appendChild(tag)
      }
      tag.content = content
    }

    setMeta("meta[name='description']",        "name",     "description",     description)
    setMeta("meta[property='og:title']",        "property", "og:title",        fullTitle)
    setMeta("meta[property='og:description']",  "property", "og:description",  description)
    const ogImage = extras.image || DEFAULT_IMAGE
    if (extras.type) setMeta("meta[property='og:type']",   "property", "og:type",  extras.type)
    setMeta("meta[property='og:image']",  "property", "og:image", ogImage)
    setMeta("meta[name='twitter:title']",       "name",     "twitter:title",       fullTitle)
    setMeta("meta[name='twitter:description']", "name",     "twitter:description", description)
    setMeta("meta[name='twitter:image']", "name", "twitter:image", ogImage)
    setMeta("meta[name='twitter:card']",  "name", "twitter:card",  "summary_large_image")

    return () => { document.title = site }
  }, [title, description, extras.type, extras.image, site])
}
