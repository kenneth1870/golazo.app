import { storageGet, storageSet } from "./safeStorage"

export const INSTALL_NUDGE_KEY = "golazo_install_nudge"

/** Call after first favorite team or first live match to show PWA install sooner. */
export function triggerInstallNudge() {
  if (storageGet(INSTALL_NUDGE_KEY)) return
  storageSet(INSTALL_NUDGE_KEY, Date.now().toString())
}

export function hasInstallNudge() {
  return !!storageGet(INSTALL_NUDGE_KEY)
}
