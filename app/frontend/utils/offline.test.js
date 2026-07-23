import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isOfflineError, isStaleCacheResponse, isOfflinePayload } from "./offline"

describe("offline helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("detects offline payload", () => {
    expect(isOfflinePayload({ error: "offline" })).toBe(true)
    expect(isOfflinePayload({ error: "other" })).toBe(false)
    expect(isOfflinePayload(null)).toBe(null)
  })

  it("detects stale cache header", () => {
    expect(isStaleCacheResponse({ headers: { get: () => "stale" } })).toBe(true)
    expect(isStaleCacheResponse({ headers: { get: () => null } })).toBe(false)
  })

  it("detects offline errors when navigator is offline", () => {
    navigator.onLine = false
    expect(isOfflineError(new Error("network"))).toBe(true)
  })

  it("ignores abort errors when online", () => {
    navigator.onLine = true
    expect(isOfflineError({ name: "AbortError" })).toBe(false)
  })
})
