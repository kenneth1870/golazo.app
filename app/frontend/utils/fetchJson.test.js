import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchJson } from "./fetchJson"

function mockResponse({ ok = true, status = 200, stale = false, body = {} } = {}) {
  return {
    ok,
    status,
    headers: { get: (k) => (k === "X-SW-Cache" && stale ? "stale" : null) },
    json: () => Promise.resolve(body),
  }
}

describe("fetchJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("returns parsed data on success", async () => {
    fetch.mockResolvedValue(mockResponse({ body: { items: [1] } }))
    const result = await fetchJson("/api/test")
    expect(result).toEqual({ data: { items: [1] }, stale: false, offline: false, ok: true })
  })

  it("flags stale cache responses", async () => {
    fetch.mockResolvedValue(mockResponse({ stale: true, body: { cached: true } }))
    const result = await fetchJson("/api/test")
    expect(result.stale).toBe(true)
    expect(result.ok).toBe(true)
  })

  it("treats offline payload as non-ok", async () => {
    fetch.mockResolvedValue(mockResponse({ ok: false, status: 503, body: { error: "offline" } }))
    const result = await fetchJson("/api/test")
    expect(result.offline).toBe(true)
    expect(result.ok).toBe(false)
  })

  it("throws on HTTP errors without offline payload", async () => {
    fetch.mockResolvedValue(mockResponse({ ok: false, status: 500, body: { error: "server" } }))
    await expect(fetchJson("/api/test")).rejects.toThrow("HTTP 500")
  })

  it("aborts slow requests", async () => {
    vi.useFakeTimers()
    fetch.mockImplementation((_url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
    }))
    const pending = fetchJson("/api/slow", 50)
    vi.advanceTimersByTime(60)
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })
})
