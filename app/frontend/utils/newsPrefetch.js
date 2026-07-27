const prefetchCache = new Map()

export function prefetchNewsArticle(id, lang) {
  if (!id || !lang) return null
  const key = `${lang}:${id}`
  if (prefetchCache.has(key)) return prefetchCache.get(key)

  const promise = Promise.all([
    fetch(`/api/v1/news/${id}?lang=${lang}`, { credentials: "same-origin" }),
    fetch(`/api/v1/news/${id}/content?lang=${lang}`, { credentials: "same-origin" }),
  ]).then(async ([metaRes, contentRes]) => ({
    meta: metaRes.ok ? await metaRes.json() : null,
    content: contentRes.ok ? await contentRes.json() : null,
  })).catch(() => ({ meta: null, content: null }))

  prefetchCache.set(key, promise)
  return promise
}

export function consumePrefetchedArticle(id, lang) {
  const key = `${lang}:${id}`
  const pending = prefetchCache.get(key)
  if (pending) prefetchCache.delete(key)
  return pending || null
}

export function attachNewsPrefetch(el, id, lang) {
  if (!el || !id) return
  const run = () => prefetchNewsArticle(id, lang)
  el.addEventListener("mouseenter", run, { once: true, passive: true })
  el.addEventListener("touchstart", run, { once: true, passive: true })
}
