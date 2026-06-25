import { useEffect, useRef } from "react"

// Run `fn` on an interval, but only while the browser tab is visible.
//
// Pauses the timer when the tab is hidden — saving API quota, redundant DB
// writes/broadcasts on the server, and battery on mobile — and fires `fn`
// immediately when the tab becomes visible again if the last run is older than
// `interval`, so the user sees fresh data without waiting a full cycle.
//
// Mirrors the hand-rolled pattern already used in HomePage / AllLeaguesPage /
// TodayMatches, centralised so every poller behaves consistently.
//
// @param {Function}    fn        callback to run on each tick
// @param {number|null} interval  ms between runs; pass null/0 to disable polling
// @param {Array}       deps      extra deps that should restart the timer
export function useVisiblePolling(fn, interval, deps = []) {
  const fnRef   = useRef(fn)
  fnRef.current = fn
  const lastRun = useRef(0)

  useEffect(() => {
    if (!interval) return

    const run = () => { lastRun.current = Date.now(); fnRef.current() }
    const tick = () => { if (!document.hidden) run() }
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastRun.current >= interval) run()
    }

    const iv = setInterval(tick, interval)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, ...deps])
}
