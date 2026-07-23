import { isOfflinePayload } from "./offline"

function resolveArgs(timeoutOrInit, legacyInit) {
  let timeoutMs = 12_000
  let init = {}

  if (typeof timeoutOrInit === "number") {
    timeoutMs = timeoutOrInit
    init = legacyInit || {}
  } else if (timeoutOrInit && typeof timeoutOrInit === "object") {
    init = timeoutOrInit
    timeoutMs = init.timeoutMs ?? 12_000
  }

  const { timeoutMs: _t, soft = false, signal, ...fetchInit } = init
  return { timeoutMs, soft, fetchInit, signal }
}

export async function fetchJson(url, timeoutOrInit = 12_000, legacyInit = {}) {
  const { timeoutMs, soft, fetchInit, signal: externalSignal } = resolveArgs(timeoutOrInit, legacyInit)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener("abort", () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch(url, { ...fetchInit, signal: controller.signal })
    const stale = res.headers.get("X-SW-Cache") === "stale"
    let data = null
    try { data = await res.json() } catch { /* non-json */ }
    const offline = res.status === 503 && isOfflinePayload(data)
    if (!res.ok && !offline && !soft) throw new Error(`HTTP ${res.status}`)
    return { data, stale, offline, ok: res.ok && !offline, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}
