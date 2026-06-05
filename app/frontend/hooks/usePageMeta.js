import { useEffect } from "react"

const SITE = "Golazo · Mundial 2026"

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : SITE

    let metaDesc = document.querySelector("meta[name='description']")
    if (!metaDesc) {
      metaDesc = document.createElement("meta")
      metaDesc.name = "description"
      document.head.appendChild(metaDesc)
    }
    if (description) metaDesc.content = description

    // OG tags
    const og = (prop, val) => {
      if (!val) return
      let tag = document.querySelector(`meta[property='${prop}']`)
      if (!tag) {
        tag = document.createElement("meta")
        tag.setAttribute("property", prop)
        document.head.appendChild(tag)
      }
      tag.content = val
    }
    og("og:title",       title ? `${title} — ${SITE}` : SITE)
    og("og:description", description)

    return () => {
      document.title = SITE
    }
  }, [title, description])
}
