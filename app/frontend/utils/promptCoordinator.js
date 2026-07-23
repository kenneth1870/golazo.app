// Ensures only one install/onboarding prompt shows at a time (mobile PWA).
let active = null

export function claimPrompt(id) {
  if (active && active !== id) return false
  active = id
  return true
}

export function releasePrompt(id) {
  if (active === id) active = null
}

export function isPromptBlocked(id) {
  return active !== null && active !== id
}
