// @refresh reset
import { createContext, useContext, useEffect, useState } from "react"

const LiveContext = createContext({ liveCount: 0 })

export function LiveProvider({ children }) {
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    let lastFetchedAt = 0
    let failCount     = 0
    let timer         = null
    let fetching      = false

    function schedule() {
      clearTimeout(timer)
      // 60s → 120s → 240s → 300s cap; resets to 60s on success
      const delay = Math.min(60_000 * (2 ** failCount), 300_000)
      timer = setTimeout(tick, delay)
    }

    function tick() {
      if (document.hidden || fetching) return
      fetching = true
      lastFetchedAt = Date.now()
      fetch("/api/v1/live_count")
        .then(r => r.json())
        .then(d => { setLiveCount(d.count ?? 0); failCount = 0 })
        .catch(() => { failCount = Math.min(failCount + 1, 4) })
        .finally(() => { fetching = false; schedule() })
    }

    const onVisible = () => {
      if (document.hidden) return
      if (Date.now() - lastFetchedAt > 55_000) tick()
    }

    tick()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return <LiveContext.Provider value={{ liveCount }}>{children}</LiveContext.Provider>
}

export function useLiveCount() {
  return useContext(LiveContext).liveCount
}
