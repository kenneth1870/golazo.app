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

// Fires a browser notification for each newly-appeared goal event.
// In-app toast fallback is handled directly in MatchShowPage via checkGoals/showToast.
export function useGoalNotifications(enabled) {
  const prevEventsRef = useRef([])

  function notifyGoal(events, homeName, awayName, homeGoals, awayGoals) {
    // Notification API is absent in some Android webviews and WKWebView without
    // explicit permission — guard before accessing to avoid ReferenceError.
    if (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return
    const prev = prevEventsRef.current
    const newGoals = (events || []).filter(
      e => e.type === "Goal" && !prev.some(p => p.minute === e.minute && p.player === e.player)
    )
    newGoals.forEach(g => {
      const scorer = g.player || ""
      const score  = `${homeGoals ?? "?"}–${awayGoals ?? "?"}`
      new Notification(`⚽ GOAL! ${g.team?.name || ""}`, {
        body: `${scorer} ${g.minute}' · ${homeName} ${score} ${awayName}`,
        icon: "/images/img_1.jpg",
      })
    })
    prevEventsRef.current = events || []
  }

  return { notifyGoal }
}
