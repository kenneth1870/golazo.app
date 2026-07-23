import { isOfflinePayload } from "./offline"

export async function fetchJson(url, timeoutMs = 12_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    const stale = res.headers.get("X-SW-Cache") === "stale"
    let data = null
    try { data = await res.json() } catch { /* non-json */ }
    const offline = res.status === 503 && isOfflinePayload(data)
    if (!res.ok && !offline) throw new Error(`HTTP ${res.status}`)
    return { data, stale, offline, ok: res.ok && !offline }
  } finally {
    clearTimeout(timer)
  }
}
