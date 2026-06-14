const CACHE_VERSION = "golazo-v8"
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const API_CACHE     = `${CACHE_VERSION}-api`
const IMAGE_CACHE   = `${CACHE_VERSION}-images`

// CDN domains to cache (team flags, crests)
const CDN_IMAGE_HOSTS = [
  "flagcdn.com",
  "crests.football-data.org",
  "media.api-sports.io",
  "media-1.api-sports.io",
  "media-2.api-sports.io",
  "media-3.api-sports.io",
]

// Font CDNs — stale-while-revalidate so the app looks correct offline
const FONT_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]

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
          .filter(k => k.startsWith("golazo-") && k !== STATIC_CACHE && k !== API_CACHE && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests
  if (request.method !== "GET") return

  // Cross-origin CDN images (team flags): cache-first, never expire
  if (CDN_IMAGE_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstImage(request))
    return
  }

  // Google Fonts: stale-while-revalidate so app looks correct offline
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Only handle same-origin beyond this point
  if (url.origin !== self.location.origin) return

  // API routes: network-first, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstApi(request))
    return
  }

  // Vite assets (hashed filenames): cache-first forever — they're immutable
  if (url.pathname.startsWith("/vite/assets/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Other static assets (fonts, images, CSS, JS): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Navigation requests (HTML): serve app shell from cache instantly,
  // revalidate in background — eliminates gray/blank screen on open
  if (request.mode === "navigate") {
    event.respondWith(shellFirst(request))
    return
  }
})

// ── Strategies ────────────────────────────────────────

// Serve shell from cache immediately; update in background (stale-while-revalidate).
// Eliminates the gray screen on slow networks — the cached shell loads instantly.
async function shellFirst(request) {
  const cache  = await caches.open(STATIC_CACHE)
  const cached = await cache.match("/")

  if (cached) {
    // Background revalidation — refresh the shell silently
    fetch(request).then(response => {
      if (response.ok) cache.put("/", response)
    }).catch(() => {})
    return cached
  }

  // First-ever load: must go to network
  try {
    const response = await fetch(request)
    if (response.ok) cache.put("/", response.clone())
    return response
  } catch {
    return caches.match("/offline.html")
  }
}

// Cache-first for CDN images (flags). Uses opaque response fallback
// so images still display even if CORS headers are missing.
async function cacheFirstImage(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    // Try CORS first for a proper cacheable response
    const response = await fetch(request, { mode: "cors" })
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE)
      await trimImageCache(cache)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Fallback: opaque no-cors fetch (won't be cached but will load)
    return fetch(request, { mode: "no-cors" }).catch(() =>
      new Response("", { status: 408, statusText: "Offline" })
    )
  }
}

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

const API_CACHE_MAX   = 150
const IMAGE_CACHE_MAX = 500  // ~500 flag/crest images before eviction
const API_TIMEOUT_MS  = 8000

async function trimApiCache(cache) {
  const keys = await cache.keys()
  if (keys.length > API_CACHE_MAX) {
    await Promise.all(keys.slice(0, keys.length - API_CACHE_MAX).map(k => cache.delete(k)))
  }
}

async function trimImageCache(cache) {
  const keys = await cache.keys()
  if (keys.length > IMAGE_CACHE_MAX) {
    await Promise.all(keys.slice(0, keys.length - IMAGE_CACHE_MAX).map(k => cache.delete(k)))
  }
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
    const response = await fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer))
    if (response.ok) {
      cache.put(request, response.clone())
      trimApiCache(cache)
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) {
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
