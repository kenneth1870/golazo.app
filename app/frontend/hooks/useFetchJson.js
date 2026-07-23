import { useState, useEffect, useCallback, useRef } from "react"
import { fetchJson } from "../utils/fetchJson"

/** Fetch JSON with loading/error/stale state. Pass null url to skip. */
export function useFetchJson(url, deps = [], { enabled = true, transform, timeoutMs } = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled && url))
  const [error, setError]     = useState(false)
  const [stale, setStale]     = useState(false)
  const [token, setToken]     = useState(0)
  const transformRef = useRef(transform)
  transformRef.current = transform

  const reload = useCallback(() => setToken(n => n + 1), [])

  useEffect(() => {
    if (!enabled || !url) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(false)
    setStale(false)

    fetchJson(url, timeoutMs)
      .then(({ data: raw, stale: isStale, offline, ok }) => {
        if (cancelled) return
        setStale(isStale)
        if (!ok || offline) {
          setError(true)
          return
        }
        const fn = transformRef.current
        setData(fn ? fn(raw) : raw)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [url, enabled, token, timeoutMs, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData, loading, error, stale, reload }
}
