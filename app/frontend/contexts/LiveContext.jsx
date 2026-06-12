import { createContext, useContext, useEffect, useState } from "react"

const LiveContext = createContext({ liveCount: 0 })

export function LiveProvider({ children }) {
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    let lastFetchedAt = 0
    const check = () => {
      if (document.hidden) return
      lastFetchedAt = Date.now()
      fetch("/api/v1/live_count")
        .then(r => r.json())
        .then(d => setLiveCount(d.count ?? 0))
        .catch(() => {})
    }
    const onVisible = () => {
      if (document.hidden) return
      if (Date.now() - lastFetchedAt > 55_000) check()
    }
    check()
    document.addEventListener("visibilitychange", onVisible)
    const iv = setInterval(check, 60000)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return <LiveContext.Provider value={{ liveCount }}>{children}</LiveContext.Provider>
}

export function useLiveCount() {
  return useContext(LiveContext).liveCount
}
