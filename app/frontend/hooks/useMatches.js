import { useState, useEffect, useCallback, useRef } from "react"

// Module-level cache so every component sharing the same filter/params
// reuses one in-flight request and one polling interval.
const cache   = new Map()  // key → { data, ts, promise }
const subs    = new Map()  // key → Set of setState callbacks
const timers  = new Map()  // key → interval id

function cacheKey(filter, { competition, group } = {}) {
  return `${filter}|${competition || ""}|${group || ""}`
}

function notify(key, data) {
  ;(subs.get(key) || new Set()).forEach(fn => fn(data))
}

async function fetchKey(key, filter, opts) {
  const params = new URLSearchParams({ filter })
  if (opts.competition) params.set("competition", opts.competition)
  if (opts.group)       params.set("group",       opts.group)

  try {
    const res  = await fetch(`/api/v1/matches?${params}`)
    if (!res.ok) throw new Error("fetch failed")
    const data = await res.json()
    cache.set(key, { data, ts: Date.now(), error: null })
    notify(key, { data, loading: false, error: null })
    return data
  } catch (e) {
    const prev = cache.get(key)
    cache.set(key, { ...(prev || {}), error: e.message })
    notify(key, { data: prev?.data || [], loading: false, error: e.message })
  }
}

function subscribe(key, filter, opts, setState) {
  if (!subs.has(key)) subs.set(key, new Set())
  subs.get(key).add(setState)

  // Start polling only once per key
  if (!timers.has(key)) {
    fetchKey(key, filter, opts)
    const id = setInterval(() => fetchKey(key, filter, opts), 30000)
    timers.set(key, id)
  } else {
    // New subscriber — send cached data immediately if available
    const cached = cache.get(key)
    if (cached?.data) setState({ data: cached.data, loading: false, error: cached.error || null })
  }
}

function unsubscribe(key, setState) {
  const set = subs.get(key)
  if (!set) return
  set.delete(setState)
  if (set.size === 0) {
    clearInterval(timers.get(key))
    timers.delete(key)
    subs.delete(key)
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
  const [match, setMatch]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return
    fetch(`/api/v1/matches/${matchId}`)
      .then(r => r.json())
      .then(setMatch)
      .finally(() => setLoading(false))
  }, [matchId])

  return { match, loading, setMatch }
}
