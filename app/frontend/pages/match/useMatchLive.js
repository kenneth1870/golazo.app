import { useState, useEffect, useRef } from "react"

// Ticks the displayed match minute forward while live. Never regresses when a
// stale poll snapshot re-sends an older minute from the date-list cache.
export function useLiveMinute(apiMinute, isLive) {
  const [minute, setMinute] = useState(apiMinute)
  const syncedAt = useRef(Date.now())
  const baseRef  = useRef(apiMinute)

  useEffect(() => {
    if (apiMinute == null) return
    setMinute(prev => {
      const next = prev == null ? apiMinute : Math.max(prev, apiMinute)
      if (next !== baseRef.current) {
        baseRef.current = next
        syncedAt.current = Date.now()
      }
      return next
    })
  }, [apiMinute])

  useEffect(() => {
    if (!isLive || baseRef.current == null) return

    const tick = () => {
      const elapsed = Math.floor((Date.now() - syncedAt.current) / 60_000)
      setMinute(baseRef.current + elapsed)
    }

    tick()
    const iv = setInterval(tick, 15_000)
    return () => clearInterval(iv)
  }, [isLive, apiMinute])

  return minute
}
