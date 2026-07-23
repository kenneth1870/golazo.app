export function isOfflineError(err) {
  if (!navigator.onLine) return true
  if (err?.name === "AbortError") return false
  return true
}

export function isStaleCacheResponse(response) {
  return response?.headers?.get?.("X-SW-Cache") === "stale"
}

export function isOfflinePayload(data) {
  return data && typeof data === "object" && data.error === "offline"
}
