import { useState, useEffect, useCallback, useRef } from "react"

// Module-level cache so every component sharing the same filter/params
// reuses one in-flight request and one polling interval.
const cache       = new Map()  // key → { data, ts, error }
const subs        = new Map()  // key → Set of setState callbacks
const timers      = new Map()  // key → { interval, onVisible }
const controllers = new Map()  // key → AbortController (current in-flight fetch)

const MAX_CACHE_ENTRIES = 15
function evictLRU() {
  if (cache.size <= MAX_CACHE_ENTRIES) return
  // Only evict keys that have no active subscribers
  let oldest = null, oldestTs = Infinity
  for (const [key, entry] of cache) {
    if (subs.has(key)) continue
    if ((entry.ts || 0) < oldestTs) { oldestTs = entry.ts || 0; oldest = key }
  }
  if (oldest) cache.delete(oldest)
}

function cacheKey(filter, { competition, group, tz } = {}) {
  return `${filter}|${competition || ""}|${group || ""}|${tz || ""}`
}

function notify(key, data) {
  ;(subs.get(key) || new Set()).forEach(fn => fn(data))
}

async function fetchKey(key, filter, opts) {
  const params = new URLSearchParams({ filter })
  if (opts.competition) params.set("competition", opts.competition)
  if (opts.group)       params.set("group",       opts.group)
  if (opts.tz)          params.set("tz",          opts.tz)

  const controller = new AbortController()
  controllers.set(key, controller)

  try {
    const res  = await fetch(`/api/v1/matches?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error("fetch failed")
    const data = await res.json()
    cache.set(key, { data, ts: Date.now(), error: null })
    evictLRU()
    notify(key, { data, loading: false, error: null })
    return data
  } catch (e) {
    if (e.name === "AbortError") return  // cancelled when last subscriber left — no notify
    const prev = cache.get(key)
    cache.set(key, { ...(prev || {}), error: e.message })
    notify(key, { data: prev?.data || [], loading: false, error: e.message })
  } finally {
    if (controllers.get(key) === controller) controllers.delete(key)
  }
}

function subscribe(key, filter, opts, setState) {
  if (!subs.has(key)) subs.set(key, new Set())
  subs.get(key).add(setState)

  if (!timers.has(key)) {
    fetchKey(key, filter, opts)

    // Skip polling when the tab is hidden; re-fetch immediately on return
    // if data is stale (older than the poll interval).
    const poll = () => { if (!document.hidden) fetchKey(key, filter, opts) }
    const onVisible = () => {
      if (document.hidden) return
      const cached = cache.get(key)
      if (!cached?.ts || Date.now() - cached.ts > 55_000) fetchKey(key, filter, opts)
    }

    document.addEventListener("visibilitychange", onVisible)
    const interval = setInterval(poll, 60_000)
    timers.set(key, { interval, onVisible })
  } else {
    const cached = cache.get(key)
    if (cached?.data) setState({ data: cached.data, loading: false, error: cached.error || null })
  }
}

function unsubscribe(key, setState) {
  const set = subs.get(key)
  if (!set) return
  set.delete(setState)
  if (set.size === 0) {
    const timer = timers.get(key)
    if (timer) {
      clearInterval(timer.interval)
      document.removeEventListener("visibilitychange", timer.onVisible)
    }
    timers.delete(key)
    subs.delete(key)
    controllers.get(key)?.abort()
    controllers.delete(key)
  }
}

export function useMatches(filter = "all", opts = {}) {
  const key = cacheKey(filter, opts)
  const [state, setState] = useState(() => {
    const cached = cache.get(key)
    return { data: cached?.data || [], loading: !cached, error: null }
  })

  const setStateRef = useRef(setState)
  setStateRef.current = setState

  useEffect(() => {
    const fn = (s) => setStateRef.current(s)
    subscribe(key, filter, opts, fn)
    return () => unsubscribe(key, fn)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => fetchKey(key, filter, opts), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return { matches: state.data, loading: state.loading, error: state.error, refetch }
}

export function useMatch(matchId) {
  const [match, setMatch]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/v1/matches/${matchId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setMatch(data) })
      .catch(() => { if (!cancelled) setMatch(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId])

  return { match, loading, setMatch }
}
