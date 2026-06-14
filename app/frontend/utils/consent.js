import { storageGet, storageSet } from "./safeStorage"

// Opt-in analytics consent. Until the user explicitly accepts, no usage
// heartbeat is sent. Values: "granted" | "denied" | null (undecided).
const CONSENT_KEY = "golazo_analytics_consent"

export function getConsent() {
  return storageGet(CONSENT_KEY) // "granted" | "denied" | null
}

export function setConsent(value) {
  storageSet(CONSENT_KEY, value)
  // Let listeners (the analytics hook) react immediately to a fresh decision.
  try { window.dispatchEvent(new CustomEvent("golazo:consent", { detail: value })) } catch {}
}

export function hasAnalyticsConsent() {
  return getConsent() === "granted"
}

export function consentDecided() {
  return getConsent() != null
}
