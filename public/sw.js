const CACHE_VERSION = "golazo-v6"
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const API_CACHE     = `${CACHE_VERSION}-api`

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/offline.html",
]

// ── Install: pre-cache shell ───────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: delete old caches ───────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith("golazo-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return

  // API routes: network-first, fall back to cache for up to 5 min
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request))
    return
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Navigation requests (HTML): network-first, offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    )
    return
  }
})

// ── Strategies ────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

const API_CACHE_MAX = 60

async function trimApiCache(cache) {
  const keys = await cache.keys()
  if (keys.length > API_CACHE_MAX) {
    await Promise.all(keys.slice(0, keys.length - API_CACHE_MAX).map(k => cache.delete(k)))
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
      trimApiCache(cache)
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      // Return stale with a header so the app can show "offline" state
      const headers = new Headers(cached.headers)
      headers.set("X-SW-Cache", "stale")
      return new Response(cached.body, { status: cached.status, headers })
    }
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    })
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|ico|webp|gif)$/.test(pathname)
}

// ── Push Notifications ────────────────────────────────
self.addEventListener("push", event => {
  if (!event.data) return

  let payload = {}
  try { payload = JSON.parse(event.data.text()) } catch {}

  const title   = payload.title  || "Golazo ⚽"
  const options = {
    body:    payload.body  || "",
    icon:    payload.icon  || "/images/apple-touch-icon.png?v=2",
    badge:   payload.badge || "/images/badge-72.png",
    tag:     payload.match_id ? `match-${payload.match_id}` : `golazo-${Date.now()}`,
    renotify: true,
    data:    { url: payload.url || "/" },
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click → open / focus app ────────────
self.addEventListener("notificationclick", event => {
  event.notification.close()
  const url = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
