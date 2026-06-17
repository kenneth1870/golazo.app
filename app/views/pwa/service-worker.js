const CACHE_NAME = "golazo-v1"
const TODAY_API  = "/api/v1/today"
const OFFLINE_URLS = ["/", TODAY_API]

// ── Install: pre-cache today's matches ──────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)).catch(() => {})
  )
  self.skipWaiting()
})

// ── Activate: clean up old caches ───────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── Fetch: network-first for API calls, cache fallback for nav ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin GET requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return

  // Today's matches API: network-first, cache for offline
  if (url.pathname.startsWith("/api/v1/today")) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // HTML navigation: network-first, fall back to cached "/"
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    )
    return
  }
})

// ── Push notifications ───────────────────────────────────
self.addEventListener("push", async (event) => {
  const { title, options } = await event.data.json()
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const path = event.notification.data?.path
      for (const client of clientList) {
        if ((new URL(client.url)).pathname === path && "focus" in client) return client.focus()
      }
      if (clients.openWindow && path) return clients.openWindow(path)
    })
  )
})
