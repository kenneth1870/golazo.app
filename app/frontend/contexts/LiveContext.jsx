import { createContext, useContext, useEffect, useState } from "react"

const LiveContext = createContext({ liveCount: 0 })

export function LiveProvider({ children }) {
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    const check = () =>
      fetch("/api/v1/today")
        .then(r => r.json())
        .then(d => {
          const all = [...(d.real || []), ...(d.local || [])]
          setLiveCount(all.filter(m => m.status === "live").length)
        })
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
