import { storageGet, storageSet } from "./safeStorage"

const DEVICE_KEY = "golazo_device_id"

// Stable per-browser identifier, persisted in localStorage. Used by push
// subscriptions, analytics tracking, and prediction ownership.
export function getDeviceId() {
  let id = storageGet(DEVICE_KEY)
  if (!id) {
    id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)
    storageSet(DEVICE_KEY, id)
  }
  return id
}
