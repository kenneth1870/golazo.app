import { useState, useEffect, useRef } from "react"

// Ticks the displayed match minute forward once a minute while a match is live,
// re-syncing whenever the API reports a fresh minute.
export function useLiveMinute(apiMinute, isLive) {
  const [minute, setMinute] = useState(apiMinute)
  useEffect(() => { setMinute(apiMinute) }, [apiMinute])
  useEffect(() => {
    if (!isLive || !apiMinute) return
    const iv = setInterval(() => setMinute(m => m + 1), 60000)
    return () => clearInterval(iv)
  }, [isLive, apiMinute])
  return minute
}

// Fires a browser notification for each newly-appeared goal event.
// In-app toast fallback is handled directly in MatchShowPage via checkGoals/showToast.
export function useGoalNotifications(enabled) {
  const prevEventsRef = useRef([])

  function notifyGoal(events, homeName, awayName, homeGoals, awayGoals) {
    if (!enabled || Notification.permission !== "granted") return
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
