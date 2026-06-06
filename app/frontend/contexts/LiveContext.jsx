import { createContext, useContext, useEffect, useState } from "react"

const LiveContext = createContext({ liveCount: 0 })

export function LiveProvider({ children }) {
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    const check = () =>
      fetch("/api/v1/live_count")
        .then(r => r.json())
        .then(d => setLiveCount(d.count ?? 0))
        .catch(() => {})

    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [])

  return <LiveContext.Provider value={{ liveCount }}>{children}</LiveContext.Provider>
}

export function useLiveCount() {
  return useContext(LiveContext).liveCount
}
