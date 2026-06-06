// Fetch with an AbortController timeout. Throws on network error or timeout.
export async function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } finally {
    clearTimeout(timer)
  }
}
