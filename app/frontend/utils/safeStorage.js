// Safe wrappers around localStorage that survive:
//  • Private / Incognito mode (SecurityError on iOS Safari)
//  • Embedded iframes with storage blocked
//  • Environments where localStorage is undefined (SSR / workers)

function available() {
  try {
    const k = "__golazo_test__"
    localStorage.setItem(k, "1")
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

const _ok = typeof window !== "undefined" && available()

export function storageGet(key, fallback = null) {
  if (!_ok) return fallback
  try { return localStorage.getItem(key) ?? fallback }
  catch { return fallback }
}

export function storageSet(key, value) {
  if (!_ok) return
  try { localStorage.setItem(key, value) } catch {}
}

export function storageRemove(key) {
  if (!_ok) return
  try { localStorage.removeItem(key) } catch {}
}
